const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const conversationService = require("../services/conversationService");
const notificationService = require("../services/notificationService");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = express.Router();

/**
 * POST /api/messages
 * Receive tenant message and get AI response with conversation threading
 */
router.post("/", async (req, res) => {
  try {
    const { tenant_id, message, channel } = req.body;

    // Validate required fields
    if (!tenant_id || !message) {
      return res.status(400).json({
        error: "Missing required fields: tenant_id and message are required"
      });
    }

    // Load tenant information
    const tenantResult = await db.query(
      "SELECT * FROM tenants WHERE id = $1",
      [tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const tenant = tenantResult.rows[0];

    // Load property information
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [tenant.property_id]
    );

    const property = propertyResult.rows[0] || null;

    // Find active thread for this tenant (API channel)
    const activeThreadResult = await db.query(
      `SELECT * FROM conversation_threads
       WHERE tenant_id = $1
        AND channel = $2
        AND status = 'active'
        ORDER BY last_activity_at DESC
        LIMIT 1`,
      [tenant_id, channel || 'api']
    );

    const activeThread = activeThreadResult.rows[0] || null;

    // Load recent messages from active thread (for topic analysis)
    let recentMessages = [];
    if (activeThread) {
      const messagesResult = await db.query(
        `SELECT * FROM messages
         WHERE thread_id = $1
         ORDER BY timestamp ASC
         LIMIT 10`,
        [activeThread.id]
      );
      recentMessages = messagesResult.rows;
    }

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(recentMessages);

    // Load open maintenance requests for context (include ID so AI can reference them)
    const maintenanceResult = await db.query(
      `SELECT id, issue_description, priority, status
       FROM maintenance_requests
       WHERE tenant_id = $1
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenant_id]
    );

    // CONVERSATIONAL DUPLICATE PREVENTION: Check for pending clarification
    const pendingClarificationResult = await db.query(
      `SELECT * FROM clarification_states
       WHERE tenant_id = $1
       AND thread_id = $2
       AND state = 'pending'
       AND expires_at > NOW()
       ORDER BY asked_at DESC
       LIMIT 1`,
      [tenant_id, activeThread ? activeThread.id : null]
    );

    const pendingClarification = pendingClarificationResult.rows[0] || null;

    // If there's a pending clarification, handle tenant's response
    if (pendingClarification) {
      console.log(`[Clarification Flow] Found pending clarification: ${pendingClarification.id}`);

      // Load the open maintenance request
      const requestResult = await db.query(
        "SELECT * FROM maintenance_requests WHERE id = $1",
        [pendingClarification.maintenance_request_id]
      );

      if (requestResult.rows.length === 0) {
        console.error(`[Clarification Flow] Maintenance request ${pendingClarification.maintenance_request_id} not found`);
        // Fallback to normal processing
      } else {
        const openRequest = requestResult.rows[0];

        // Analyze tenant's response
        const analysis = await aiService.analyzeClarificationResponse(message, [openRequest]);

        console.log(`[Clarification Flow] Analysis: intent=${analysis.intent}, requestId=${analysis.requestId}, confidence=${analysis.confidence}`);

        // Update clarification state as answered
        await db.query(
          `UPDATE clarification_states
           SET state = 'answered', answered_at = NOW()
           WHERE id = $1`,
          [pendingClarification.id]
        );

        // Handle based on intent
        if (analysis.intent === "same" || analysis.intent === "number") {
          const requestId = analysis.requestId || openRequest.id;

          console.log(`[Clarification Flow] Tenant confirmed same issue, updating request ${requestId}`);

          // Update existing request
          const updateResult = await updateExistingRequest(
            requestId,
            'normal', // Default priority for confirmation
            message, // Use tenant's message as new description
            tenant.id,
            property ? property.id : null,
            'clarification-flow'
          );

          // Generate confirmation response
          const confirmationResponse = `Thanks for confirming! I've updated your maintenance request about "${openRequest.issue_description}" with the new details.`;

          // Log messages
          const messageResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, message_type, timestamp)
             VALUES ($1, $2, $3, $4, 'user_message', NOW())
             RETURNING *`,
            [activeThread.id, tenant.id, channel || 'api', message]
          );

          const responseResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, 'ai_response', NOW())
             RETURNING *`,
            [
              activeThread.id,
              tenant.id,
              channel || 'api',
              message,
              confirmationResponse,
              null // No actions for confirmation
            ]
          );

          // Update thread activity
          await db.query(
            `UPDATE conversation_threads
             SET last_activity_at = NOW()
             WHERE id = $1`,
            [activeThread.id]
          );

          const cleanResponse = aiService.stripJSONFromResponse(confirmationResponse);

          return res.json({
            success: true,
            response: confirmationResponse,
            response_display: cleanResponse,
            actions: [{ ...updateResult, status: "executed" }],
            awaiting_clarification: false,
            thread_id: activeThread.id,
            is_new_thread: false,
            user_message: messageResult.rows[0],
            ai_message: responseResult.rows[0],
          });
        } else {
          // Different issue - create new request
          console.log(`[Clarification Flow] Tenant confirmed different issue, creating new request`);

          // Extract actions from AI to get maintenance request details
          const tempAnalysis = await aiService.generateResponseWithAnalysis(
            property,
            tenant,
            conversationHistory,
            message,
            maintenanceResult.rows,
            activeThread
          );

          const actions = aiService.extractActions(tempAnalysis.response);
          const deduplicatedActions = aiService.deduplicateActions(actions);

          // Execute actions (should create new request)
          const executedActions = [];
          for (const action of deduplicatedActions) {
            try {
              const result = await executeAction(
                action,
                tenant.id,
                property ? property.id : null,
                activeThread.id,
                null, // No message ID yet
                message  // Pass userMessage for escalation detection
              );
              executedActions.push({ ...action, status: "executed", result });
            } catch (error) {
              console.error("Failed to execute action:", error);
              executedActions.push({ ...action, status: "failed", error: error.message });
            }
          }

          const confirmationResponse = `Thanks for clarifying! I've created a new maintenance request for this issue.`;

          // Log messages
          const messageResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, message_type, timestamp)
             VALUES ($1, $2, $3, $4, 'user_message', NOW())
             RETURNING *`,
            [activeThread.id, tenant.id, channel || 'api', message]
          );

          const responseResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, 'ai_response', NOW())
             RETURNING *`,
            [
              activeThread.id,
              tenant.id,
              channel || 'api',
              message,
              confirmationResponse,
              JSON.stringify(actions)
            ]
          );

          // Update thread activity
          await db.query(
            `UPDATE conversation_threads
             SET last_activity_at = NOW()
             WHERE id = $1`,
            [activeThread.id]
          );

          const cleanResponse = aiService.stripJSONFromResponse(confirmationResponse);

          return res.json({
            success: true,
            response: confirmationResponse,
            response_display: cleanResponse,
            actions: executedActions,
            awaiting_clarification: false,
            thread_id: activeThread.id,
            is_new_thread: false,
            user_message: messageResult.rows[0],
            ai_message: responseResult.rows[0],
          });
        }
      }
    }

    // No pending clarification - check if we should ask one
    // Only ask if: 1) there are open maintenance requests, 2) not an emergency, 3) clarification hasn't been asked yet
    const shouldAskClarification = maintenanceResult.rows.length > 0 &&
                                   !aiService.isEmergency(message) &&
                                   (!activeThread || activeThread.clarification_asked === false);

    if (shouldAskClarification) {
      console.log(`[Clarification Flow] Found ${maintenanceResult.rows.length} open maintenance request(s) and clarification not asked yet`);

      // Generate clarification question
      const clarification = await aiService.generateClarificationQuestion(
        tenant.name,
        maintenanceResult.rows,
        message
      );

      if (clarification.shouldAsk) {
        console.log(`[Clarification Flow] Asking clarification: "${clarification.question}"`);

        // Create new thread if needed for clarification
        let clarificationThreadId = activeThread ? activeThread.id : null;
        let isNewThread = false;

        if (!clarificationThreadId) {
          const subject = await aiService.extractSubject(message);
          const threadResult = await db.query(
            `INSERT INTO conversation_threads
             (tenant_id, property_id, subject, channel, created_at, last_activity_at, clarification_asked)
             VALUES ($1, $2, $3, $4, NOW(), NOW(), true)
             RETURNING *`,
            [tenant.id, property ? property.id : null, subject, channel || 'api']
          );
          clarificationThreadId = threadResult.rows[0].id;
          isNewThread = true;
          console.log(`[Clarification Flow] Created new thread ${clarificationThreadId} for clarification`);
        } else {
          // Mark existing thread as having asked clarification
          await db.query(
            `UPDATE conversation_threads
             SET clarification_asked = true
             WHERE id = $1`,
            [clarificationThreadId]
          );
          console.log(`[Clarification Flow] Marked thread ${clarificationThreadId} as having asked clarification`);
        }

        // Save clarification state
        await db.query(
          `INSERT INTO clarification_states
           (tenant_id, thread_id, maintenance_request_id, channel, state, question, asked_at, expires_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW() + INTERVAL '24 hours')
           RETURNING *`,
          [
            tenant.id,
            clarificationThreadId,
            maintenanceResult.rows[0].id, // Most recent request
            channel || 'api',
            clarification.question,
          ]
        );

        // Save messages
        const messageResult = await db.query(
          `INSERT INTO messages
           (thread_id, tenant_id, channel, message, message_type, timestamp)
           VALUES ($1, $2, $3, $4, 'user_message', NOW())
           RETURNING *`,
          [clarificationThreadId, tenant.id, channel || 'api', message]
        );

        const responseResult = await db.query(
          `INSERT INTO messages
           (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, 'ai_response', NOW())
           RETURNING *`,
          [
            clarificationThreadId,
            tenant.id,
            channel || 'api',
            message,
            clarification.question,
            null // No actions for clarification question
          ]
        );

        // Update thread activity
        await db.query(
          `UPDATE conversation_threads
           SET last_activity_at = NOW()
           WHERE id = $1`,
          [clarificationThreadId]
        );

        const cleanResponse = aiService.stripJSONFromResponse(clarification.question);

        return res.json({
          success: true,
          response: clarification.question,
          response_display: cleanResponse,
          actions: [],
          awaiting_clarification: true,
          thread_id: clarificationThreadId,
          is_new_thread: isNewThread,
          user_message: messageResult.rows[0],
          ai_message: responseResult.rows[0],
        });
      }
    } else if (maintenanceResult.rows.length > 0 && !aiService.isEmergency(message)) {
      console.log(`[Clarification Flow] Skipping clarification - already asked for this thread`);
    }

    // No clarification needed - process normally
    console.log(`[Clarification Flow] No clarification needed, processing normally`);

    // Generate AI response with thread analysis
    const analysis = await aiService.generateResponseWithAnalysis(
      property,
      tenant,
      conversationHistory,
      message,
      maintenanceResult.rows,
      activeThread
    );

    const { response, topicAnalysis, resolutionAnalysis } = analysis;

    // Determine if we should continue current thread or create new one
    let threadId;
    let isNewThread = false;

    if (activeThread && topicAnalysis.shouldContinue) {
      // Continue existing thread
      threadId = activeThread.id;

      // Update thread activity
      await db.query(
        `UPDATE conversation_threads
           SET last_activity_at = NOW()
           WHERE id = $1`,
        [threadId]
      );

      // Check if conversation is resolved - close it immediately
      if (resolutionAnalysis.isResolved && resolutionAnalysis.confidence >= 0.7) {
        console.log(`[Thread Management] Closing thread ${threadId} as resolved`);
        await db.query(
          `UPDATE conversation_threads
            SET status = 'closed',
                resolved_at = NOW(),
                closed_at = NOW(),
                closure_confidence = $1,
                closure_factors = $2
            WHERE id = $1`,
          [
            resolutionAnalysis.confidence,
            JSON.stringify({
              reason: 'ai_resolution',
              confidence: resolutionAnalysis.confidence,
              reasoning: resolutionAnalysis.reasoning
            })
          ],
          [threadId]
        );
        
        // Log closure event
        await conversationService.logConversationEvent(
          threadId,
          tenant.id,
          'auto_closed',
          {
            reason: 'ai_resolution',
            confidence: resolutionAnalysis.confidence,
            reasoning: resolutionAnalysis.reasoning
          }
        );
      }
    } else {
      // Create new thread
      const subject = topicAnalysis.newSubject || await aiService.extractSubject(message);

      const threadResult = await db.query(
        `INSERT INTO conversation_threads
           (tenant_id, property_id, subject, channel, created_at, last_activity_at, clarification_asked)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), false)
           RETURNING *`,
        [tenant.id, property ? property.id : null, subject, channel || 'api']
      );

      threadId = threadResult.rows[0].id;
      isNewThread = true;
      console.log(`[Thread Management] Created new thread ${threadId}: "${subject}"`);
    }

    // Extract actions from AI response
    const actions = aiService.extractActions(response);
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log deduplication metrics
    console.log(`[Deduplication Metrics] Tenant: ${tenant.id}, Property: ${property ? property.id : 'N/A'}`);
    console.log(`  Total actions extracted: ${actions.length}`);
    console.log(`  Deduplicated actions: ${deduplicatedActions.length}`);
    console.log(`  Actions removed: ${actions.length - deduplicatedActions.length}`);

    // Log tenant message
    const messageResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, message_type, timestamp)
       VALUES ($1, $2, $3, $4, 'user_message', NOW())
       RETURNING *`,
      [threadId, tenant.id, channel || 'api', message]
    );

    const savedMessage = messageResult.rows[0];

    // Log AI response
    const responseResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, 'ai_response', NOW())
       RETURNING *`,
      [
        threadId,
        tenant.id,
        channel || 'api',
        message, // Store original message for reference
        response,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ]
    );

    const savedResponse = responseResult.rows[0];
    console.log(`Saved messages: ${savedMessage.id} (user), ${savedResponse.id} (AI)`);

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    console.log(`[Action Execution] Extracted ${deduplicatedActions.length} action(s):`, JSON.stringify(deduplicatedActions, null, 2));

    // Track duplicate prevention metrics
    let preActionChecks = 0;
    let ruleBasedDetections = 0;
    let aiBasedDetections = 0;
    let duplicatesPrevented = 0;

    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          threadId, // Pass threadId
          savedResponse.id, // Pass messageId
          message  // Pass userMessage for escalation detection
        );

        // Track metrics
        if (result.deduplication_layer) {
          preActionChecks++;
          duplicatesPrevented++;

          if (result.deduplication_layer === 'rule-based') {
            ruleBasedDetections++;
          } else if (result.deduplication_layer === 'ai-based') {
            aiBasedDetections++;
          }
        }

        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({ ...action, status: "failed", error: error.message });
      }
    }

    // Log final deduplication metrics
    console.log(`[Deduplication Metrics Summary]`);
    console.log(`  Pre-action checks performed: ${preActionChecks}`);
    console.log(`  Rule-based detections: ${ruleBasedDetections}`);
    console.log(`  AI-based detections: ${aiBasedDetections}`);
    console.log(`  Total duplicates prevented: ${duplicatesPrevented}`);
    console.log(`  Actions executed: ${executedActions.length}`);

    // Strip JSON from response for user display
    const cleanResponse = aiService.stripJSONFromResponse(response);

    res.json({
      success: true,
      response: response,
      response_display: cleanResponse,
      actions: executedActions,
      deduplicated_from: actions.length,
      thread_id: threadId,
      is_new_thread: isNewThread,
      user_message: savedMessage,
      ai_message: savedResponse,
    });
  } catch (error) {
    console.error("Handle message error:", error);
    res.status(500).json({
      error: "Failed to process message",
      details: error.message
    });
  }
});

/**
 * Detect if message is an escalation of existing issue
 * @param {String} message - Tenant message
 * @returns {Object} { isEscalation: boolean, confidence: number, priority: string|null }
 */
async function detectEscalation(message) {
  const escalationPatterns = [
    { pattern: /getting worse/i, priority: "urgent" },
    { pattern: /make it emergency/i, priority: "emergency" },
    { pattern: /escalate/i, priority: "urgent" },
    { pattern: /urgent now/i, priority: "urgent" },
    { pattern: /priority change/i, priority: null },
    { pattern: /actually it's/i, priority: null },
    { pattern: /worsening/i, priority: "urgent" },
    { pattern: /emergency now/i, priority: "emergency" },
    { pattern: /need this fixed ASAP/i, priority: "urgent" },
    { pattern: /it's flooding/i, priority: "emergency" },
  ];

  for (const { pattern, priority } of escalationPatterns) {
    if (pattern.test(message)) {
      return {
        isEscalation: true,
        confidence: 0.9,
        priority: priority,
      };
    }
  }

  return { isEscalation: false, confidence: 0.0, priority: null };
}

/**
 * Check for similar maintenance requests across all threads for a tenant
 * @param {Number} tenantId - Tenant ID
 * @param {Number} threadId - Current thread ID (for context)
 * @param {String} newMessage - New tenant message (for context)
 * @param {String} priority - Priority level
 * @param {String} description - New issue description
 * @param {Number} propertyId - Property ID
 * @returns {Object|null} Similar request analysis result
 */
async function checkForSimilarMaintenanceRequest(tenantId, threadId, newMessage, priority, description, propertyId) {
  // Check for open maintenance requests across all threads for this tenant (last 30 days)
  const tenantRequests = await db.query(
    `SELECT mr.*, m.thread_id, ct.subject as thread_subject, ct.channel as thread_channel
     FROM maintenance_requests mr
     JOIN messages m ON mr.message_id = m.id
     LEFT JOIN conversation_threads ct ON m.thread_id = ct.id
     WHERE mr.tenant_id = $1
     AND mr.status IN ('open', 'in_progress')
     AND mr.created_at > NOW() - INTERVAL '30 days'
     ORDER BY mr.created_at DESC
     LIMIT 5`,
    [tenantId]
  );

  if (tenantRequests.rows.length > 0) {
    // Get current thread subject for comparison
    const currentThreadResult = await db.query(
      `SELECT subject, channel FROM conversation_threads WHERE id = $1`,
      [threadId]
    );
    const currentThread = currentThreadResult.rows[0] || { subject: 'New conversation', channel: 'api' };

    // Build context for AI analysis
    const existingRequestsWithContext = tenantRequests.rows.map(req => {
      const timeDiff = Math.floor((new Date() - new Date(req.created_at)) / (1000 * 60 * 60 * 24)); // days
      return {
        id: req.id,
        description: req.issue_description,
        priority: req.priority,
        thread_id: req.thread_id,
        thread_subject: req.thread_subject || 'Unknown',
        thread_channel: req.thread_channel || 'api',
        days_ago: timeDiff,
        is_same_thread: req.thread_id === threadId
      };
    });

    const existingDescriptions = existingRequestsWithContext
      .map(req => `[ID: ${req.id}] ${req.description} (Priority: ${req.priority}, Thread: "${req.thread_subject}", ${req.days_ago} days ago, ${req.is_same_thread ? 'same thread' : 'different thread'})`)
      .join('\n');

    const existingSubjects = existingRequestsWithContext
      .map(req => req.thread_subject)
      .filter(s => s)
      .join(' | ');

    // Calculate time gap to most recent request
    const mostRecent = existingRequestsWithContext[0];
    const timeGap = mostRecent ? mostRecent.days_ago : 0;

    // Check if channels differ
    const channelDiff = mostRecent && mostRecent.thread_channel !== currentThread.channel
      ? `${mostRecent.thread_channel} → ${currentThread.channel}`
      : 'same';

    const prompt = `You are analyzing maintenance requests to detect duplicates across different conversation threads.

EXISTING REQUESTS (may be from different threads):
${existingDescriptions}

NEW MESSAGE:
"${newMessage}"
NEW DESCRIPTION: "${description}"
NEW THREAD SUBJECT: "${currentThread.subject}"
NEW CHANNEL: "${currentThread.channel}"

ANALYSIS CONTEXT:
- Time gap: ${timeGap} days between requests
- Channel difference: ${channelDiff} (SMS vs email vs WhatsApp)
- Thread subject similarity: Compare "${currentThread.subject}" with "${existingSubjects}"

Return JSON:
{
  "is_same_issue": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "existing_request_id": ID if same issue,
  "should_update_existing": true or false,
  "action": "update_existing|create_new_linked|create_new_independent"
}

GUIDELINES:

SAME ISSUE (is_same_issue: true):
- Same problem described differently
- Same location/room/apartment
- Follow-up to previous issue
- Escalation of existing issue
- De-escalation of existing issue

DIFFERENT ISSUE (is_same_issue: false):
- Completely different problem
- Different location/room/apartment
- Different property entirely
- Unrelated topic

SHOULD UPDATE EXISTING (should_update_existing: true):
- Time gap < 7 days
- Same or higher priority
- Same channel
- Same or similar thread subject

CREATE NEW LINKED (action: "create_new_linked"):
- Time gap >= 7 days
- Different channel
- Different thread subject
- Same issue but significant context change

CREATE NEW INDEPENDENT (action: "create_new_independent"):
- Time gap >= 30 days
- Completely different issue
- Different property

CONFIDENCE THRESHOLDS - LOWERED FOR BETTER DETECTION:
- Confidence >= 0.25 → same issue (lowered from 0.3 for more aggressive detection)
- Confidence < 0.25 → different issue

EXAMPLES:

Example 1 - Escalation (Update Existing):
Time gap: 3 days, Same channel, Same subject, Priority change
→ is_same_issue: true, should_update_existing: true, action: "update_existing"

Example 2 - Same Issue Different Description (Update Existing):
Time gap: 5 days, Same channel, Similar subject
→ is_same_issue: true, should_update_existing: true, action: "update_existing"

Example 3 - Update Existing:
Time gap: 2 hours, Same channel, Same subject
→ should_update_existing: true, action: "update_existing"

Example 3 - Different Issue (Create New):
Time gap: 1 day, Different channel, Completely different subject
→ is_same_issue: false, should_update_existing: false, action: "create_new_independent"

Example 4 - Create New Linked:
Time gap: 10 days, Different channel (SMS → email), Same issue
→ should_update_existing: false, action: "create_new_linked"

Example 5 - Create New Independent:
Time gap: 60 days, Different issue entirely
→ should_update_existing: false, action: "create_new_independent"

IMPORTANT: When in doubt, treat as SAME issue. Better to link requests than create duplicates.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 400,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Log deduplication analysis for tracking
      console.log(`[Cross-Thread Deduplication] Tenant: ${tenantId}, Confidence: ${result.confidence}, Same Issue: ${result.is_same_issue}, Action: ${result.action}, Reasoning: ${result.reasoning}`);
if (result.is_same_issue && result.confidence >= 0.25 && result.existing_request_id) {
  const existingRequest = tenantRequests.rows.find(r => r.id === result.existing_request_id);
  
  console.log(`[Maintenance Request Deduplication] Duplicate detected! Request ID: ${existingRequest.id}, Confidence: ${result.confidence}, Action: ${result.action}`);
  
  return {
    request: existingRequest,
    isDuplicate: true,
    confidence: result.confidence,
    reasoning: result.reasoning,
    shouldUpdateExisting: result.should_update_existing,
    action: result.action,
    isSameThread: existingRequest.thread_id === threadId
  };
} else {
  console.log(`[Cross-Thread Deduplication] No duplicate found (confidence: ${result.confidence}). Creating new request.`);
}
    } catch (error) {
      console.error("[Cross-Thread Deduplication] AI deduplication error:", error);
      return null;
    }
  }

  // Fallback: return null if no similar requests found
  return null;
}

/**
 * Rule-based duplicate detection (fast, reliable fallback)
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @param {String} description - New issue description
 * @param {String} priority - Priority level
 * @returns {Object|null} Duplicate request or null
 */
async function detectDuplicateByRules(tenantId, propertyId, description, priority) {
  // Check for requests in last 7 days (expanded time window for escalations)
  const recentRequests = await db.query(
    `SELECT * FROM maintenance_requests
     WHERE tenant_id = $1
     AND property_id = $2
     AND status IN ('open', 'in_progress')
     AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC
     LIMIT 5`,
    [tenantId, propertyId]
  );

  if (recentRequests.rows.length === 0) {
    return null;
  }

  console.log(`[Rule-Based Deduplication] Found ${recentRequests.rows.length} recent request(s) in last 7 days`);

  // Extract keywords from new description
  const newKeywords = extractKeywords(description.toLowerCase());

  // Check each recent request for keyword overlap
  for (const existingRequest of recentRequests.rows) {
    const existingKeywords = extractKeywords(existingRequest.issue_description.toLowerCase());

    // Calculate keyword overlap
    const overlap = calculateKeywordOverlap(newKeywords, existingKeywords);

    // LOWERED THRESHOLD: 30% overlap = duplicate (was 50%)
    if (overlap >= 0.3) {
      console.log(`[Rule-Based Deduplication] Duplicate detected by keyword overlap: ${overlap.toFixed(2)}`);
      console.log(`  New: "${description}"`);
      console.log(`  Existing: "${existingRequest.issue_description}"`);
      console.log(`  Existing Request ID: ${existingRequest.id}`);
      console.log(`  Overlap: ${(overlap * 100).toFixed(0)}%`);

      return {
        request: existingRequest,
        isDuplicate: true,
        confidence: overlap,
        reasoning: `Keyword overlap: ${(overlap * 100).toFixed(0)}%`,
        shouldUpdateExisting: true,
        isSameThread: true // Assume same thread for rule-based
      };
    }

    // NEW: Priority escalation check (even with lower keyword overlap)
    if (priority === 'emergency' && existingRequest.priority !== 'emergency') {
      const escalationOverlap = calculateKeywordOverlap(newKeywords, existingKeywords);

      // Even lower threshold for escalation: 20% overlap = duplicate
      if (escalationOverlap >= 0.2) {
        console.log(`[Rule-Based Deduplication] Escalation detected (overlap: ${escalationOverlap.toFixed(2)})`);
        console.log(`  New Priority: ${priority}, Existing Priority: ${existingRequest.priority}`);
        console.log(`  Existing Request ID: ${existingRequest.id}`);
        console.log(`  Overlap: ${(escalationOverlap * 100).toFixed(0)}%`);

        return {
          request: existingRequest,
          isDuplicate: true,
          confidence: escalationOverlap,
          reasoning: `Priority escalation with ${(escalationOverlap * 100).toFixed(0)}% keyword overlap`,
          shouldUpdateExisting: true,
          isSameThread: true
        };
      }
    }

    // NEW: Location-based deduplication (same room/area)
    const newLocation = extractLocation(description.toLowerCase());
    const existingLocation = extractLocation(existingRequest.issue_description.toLowerCase());

    if (newLocation && existingLocation && newLocation === existingLocation) {
      const locationOverlap = calculateKeywordOverlap(newKeywords, existingKeywords);

      // If same location with any keyword overlap (20%+), it's a duplicate
      if (locationOverlap >= 0.2) {
        console.log(`[Rule-Based Deduplication] Same location detected: ${newLocation}`);
        console.log(`  New: "${description}"`);
        console.log(`  Existing: "${existingRequest.issue_description}"`);
        console.log(`  Existing Request ID: ${existingRequest.id}`);

        return {
          request: existingRequest,
          isDuplicate: true,
          confidence: locationOverlap,
          reasoning: `Same location (${newLocation}) with ${(locationOverlap * 100).toFixed(0)}% keyword overlap`,
          shouldUpdateExisting: true,
          isSameThread: true
        };
      }
    }
  }

  console.log(`[Rule-Based Deduplication] No duplicate found by rules`);
  return null;
}

/**
 * Extract location/room from description
 * @param {String} text - Description text
 * @returns {String|null} Extracted location or null
 */
function extractLocation(text) {
  const locationKeywords = [
    'kitchen', 'bathroom', 'bedroom', 'living room', 'livingroom',
    'hallway', 'garage', 'basement', 'attic', 'roof',
    'sink', 'toilet', 'shower', 'tub', 'faucet',
    'ac', 'air conditioner', 'heater', 'furnace', 'thermostat',
    'window', 'door', 'floor', 'ceiling', 'wall'
  ];

  for (const keyword of locationKeywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Extract keywords from description
 * @param {String} text - Description text
 * @returns {Array} Array of keywords
 */
function extractKeywords(text) {
  // Common maintenance-related words to ignore
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'want', 'like', 'just', 'only', 'very', 'too', 'really', 'getting', 'causing', 'reported', 'awaiting', 'further', 'details', 'location', 'severity'];
  
  // Split into words and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  return words;
}

/**
 * Calculate keyword overlap between two keyword arrays
 * @param {Array} keywords1 - First set of keywords
 * @param {Array} keywords2 - Second set of keywords
 * @returns {Number} Overlap ratio (0.0-1.0)
 */
function calculateKeywordOverlap(keywords1, keywords2) {
  if (keywords1.length === 0 || keywords2.length === 0) {
    return 0;
  }
  
  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];
  
  return intersection.length / union.length;
}

/**
 * Handle cross-thread duplicate maintenance requests
 * @param {Object} existingRequest - The existing maintenance request
 * @param {Object} newRequestData - Data for the new request
 * @param {Object} analysisResult - AI analysis result
 * @param {Number} propertyId - Property ID
 * @param {Number} tenantId - Tenant ID
 * @param {Number} messageId - Message ID
 * @returns {Object} Result of handling the duplicate
 */
async function handleCrossThreadDuplicate(
  existingRequest,
  newRequestData,
  analysisResult,
  propertyId,
  tenantId,
  messageId
) {
  const { priority, description } = newRequestData;

  switch (analysisResult.action) {
    case "update_existing":
      // Update existing request across threads
      const updatedResult = await db.query(
        `UPDATE maintenance_requests
         SET priority = $1,
             issue_description = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [
          priority,
          description,
          existingRequest.id,
        ],
      );

      console.log(`[Cross-Thread Deduplication] Updated existing request ${existingRequest.id} across threads`);
      return {
        action: "updated",
        request_id: existingRequest.id,
        priority,
        is_duplicate: false,
        deduplication_layer: 'cross-thread-ai',
      };

    case "create_new_linked":
      // Create new request but link to existing one
      const linkedResult = await db.query(
        `INSERT INTO maintenance_requests
         (property_id, tenant_id, message_id, issue_description, priority, status, related_request_id, is_duplicate, duplicate_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, 'open', $6, true, $7, NOW())
         RETURNING *`,
        [
          propertyId,
          tenantId,
          messageId,
          description,
          priority,
          existingRequest.id,
          analysisResult.reasoning,
        ],
      );

      console.log(`[Cross-Thread Deduplication] Created linked request ${linkedResult.rows[0].id} → ${existingRequest.id}`);
      return {
        action: "linked",
        request_id: linkedResult.rows[0].id,
        related_to: existingRequest.id,
        priority,
        is_duplicate: true,
        duplicate_reason: analysisResult.reasoning,
        deduplication_layer: 'cross-thread-ai',
      };

    case "create_new_independent":
      // Create completely new request (no linking)
      const independentResult = await db.query(
        `INSERT INTO maintenance_requests
         (property_id, tenant_id, message_id, issue_description, priority, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'open', NOW())
         RETURNING *`,
        [propertyId, tenantId, messageId, description, priority],
      );

      console.log(`[Cross-Thread Deduplication] Created independent request ${independentResult.rows[0].id}`);
      return {
        action: "created",
        request_id: independentResult.rows[0].id,
        priority,
        is_duplicate: false,
        deduplication_layer: 'none',
      };

    default:
      throw new Error(`Unknown action: ${analysisResult.action}`);
  }
}

/**
 * Pre-action duplicate check to prevent duplicate maintenance requests
 * @param {Object} action - Action object with type and details
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @param {Number} messageId - Message ID
 * @param {String} userMessage - Original user message (for escalation detection)
 * @returns {Object|null} Duplicate detection result or null
 */
async function preActionDuplicateCheck(action, tenantId, propertyId, messageId, userMessage) {
  // Only check maintenance_request actions
  if (action.action !== 'maintenance_request') {
    return null;
  }

  const { priority, description, existing_request_id } = action;

  // If AI already provided existing_request_id, use it
  if (existing_request_id) {
    console.log(`[Pre-Action Deduplication] AI provided existing_request_id: ${existing_request_id}`);
    return {
      type: 'ai_provided',
      requestId: existing_request_id,
      confidence: 1.0,
      reasoning: 'AI explicitly identified existing request'
    };
  }

  // NEW: Check for escalation patterns in user message
  if (userMessage) {
    const escalationCheck = await detectEscalation(userMessage);
    if (escalationCheck.isEscalation) {
      console.log(`[Pre-Action Deduplication] Escalation detected! Finding most recent open request...`);

      // Find the most recent open maintenance request for this tenant
      const recentRequest = await db.query(
        `SELECT * FROM maintenance_requests
         WHERE tenant_id = $1
         AND property_id = $2
         AND status IN ('open', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantId, propertyId]
      );

      if (recentRequest.rows.length > 0) {
        const existingRequest = recentRequest.rows[0];
        console.log(`[Pre-Action Deduplication] Found existing request ${existingRequest.id} for escalation`);
        console.log(`  Previous priority: ${existingRequest.priority}, Escalating to: ${priority || escalationCheck.priority}`);

        return {
          type: 'escalation',
          requestId: existingRequest.id,
          confidence: escalationCheck.confidence,
          reasoning: `Escalation detected: "${userMessage}"`,
          suggestedPriority: priority || escalationCheck.priority
        };
      } else {
        console.log(`[Pre-Action Deduplication] Escalation detected but no open requests found. Will create new request.`);
      }
    }
  }

  // Check for similar requests in last 7 days (expanded time window for escalations)
  const recentRequests = await db.query(
    `SELECT * FROM maintenance_requests
     WHERE tenant_id = $1
     AND property_id = $2
     AND status IN ('open', 'in_progress')
     AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC
     LIMIT 5`,
    [tenantId, propertyId]
  );

  if (recentRequests.rows.length === 0) {
    console.log(`[Pre-Action Deduplication] No recent requests found in last 7 days`);
    return null;
  }

  console.log(`[Pre-Action Deduplication] Found ${recentRequests.rows.length} recent request(s) to check`);

  // Use AI to determine if this is a duplicate
  const analysis = await analyzeDuplicateWithAI(
    action,
    recentRequests.rows,
    tenantId,
    propertyId
  );

  if (analysis.isDuplicate && analysis.confidence >= 0.6) {
    console.log(`[Pre-Action Deduplication] Duplicate detected!`);
    console.log(`  Existing Request ID: ${analysis.existingRequestId}`);
    console.log(`  Confidence: ${analysis.confidence.toFixed(2)}`);
    console.log(`  Reasoning: ${analysis.reasoning}`);

    return {
      type: 'detected',
      requestId: analysis.existingRequestId,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning
    };
  }

  console.log(`[Pre-Action Deduplication] No duplicate detected (confidence: ${analysis.confidence.toFixed(2)})`);
  return null;
}

/**
 * Semantic similarity check without time limit
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @param {String} description - New issue description
 * @returns {Object|null} Similar request or null
 */
async function checkSemanticSimilarity(tenantId, propertyId, description) {
  // Get ALL open/in-progress requests (no time limit)
  const allRequests = await db.query(
    `SELECT * FROM maintenance_requests
     WHERE tenant_id = $1
     AND property_id = $2
     AND status IN ('open', 'in_progress')
     ORDER BY created_at DESC
     LIMIT 10`,
    [tenantId, propertyId]
  );

  if (allRequests.rows.length === 0) {
    return null;
  }

  console.log(`[Semantic Similarity] Checking ${allRequests.rows.length} open request(s) for semantic similarity`);

  // Use AI to check for semantic similarity
  const prompt = `Check if this is a duplicate:

EXISTING REQUESTS:
${allRequests.rows.map(r => `[ID: ${r.id}] ${r.issue_description} (Priority: ${r.priority}, Created: ${r.created_at})`).join('\n')}

NEW REQUEST: "${description}"

Return JSON:
{
  "is_duplicate": true/false,
  "confidence": 0.0-1.0,
  "existing_request_id": ID if duplicate
}

Guidelines:
- Same problem described differently = duplicate
- Same location/room = duplicate
- Follow-up or escalation = duplicate
- When in doubt, mark as duplicate

CRITICAL: Time does NOT matter. A request 2 days ago about the same leak is STILL THE SAME ISSUE.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content);

    if (result.is_duplicate && result.confidence >= 0.6) {
      const existingRequest = allRequests.rows.find(r => r.id === result.existing_request_id);
      
      console.log(`[Semantic Similarity] Duplicate detected! Request ID: ${existingRequest.id}, Confidence: ${result.confidence}`);
      
      return {
        request: existingRequest,
        isDuplicate: true,
        confidence: result.confidence,
        reasoning: 'Semantic similarity check',
        shouldUpdateExisting: true
      };
    }

    console.log(`[Semantic Similarity] No duplicate found (confidence: ${result.confidence})`);
    return null;
  } catch (error) {
    console.error("[Semantic Similarity] Error:", error);
    return null;
  }
}

/**
 * Use AI to analyze if action is a duplicate
 * @param {Object} action - New action
 * @param {Array} existingRequests - Existing maintenance requests
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @returns {Object} AI analysis result
 */
async function analyzeDuplicateWithAI(action, existingRequests, tenantId, propertyId) {
  const existingDescriptions = existingRequests
    .map(req => `[ID: ${req.id}] ${req.issue_description} (Priority: ${req.priority}, Created: ${req.created_at})`)
    .join('\n');

  const prompt = `You are analyzing if a new maintenance request is a duplicate of existing requests.

EXISTING REQUESTS (last 1 hour):
${existingDescriptions}

NEW REQUEST:
Action: ${action.action}
Priority: ${action.priority}
Description: "${action.description}"

Analyze if this new request is a DUPLICATE or DIFFERENT issue.

Return JSON:
{
  "is_duplicate": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "existing_request_id": ID if duplicate, else null
}

GUIDELINES:

DUPLICATE (is_duplicate: true):
- Same problem described differently
- Same location/room/apartment
- Follow-up to previous issue
- Providing more details about existing issue
- Escalating or de-escalating existing problem
- Tenant confirming or clarifying existing problem

DIFFERENT (is_duplicate: false):
- Completely different problem
- Different location/room/apartment
- Different property entirely
- Unrelated topic

CONFIDENCE THRESHOLDS:
- Confidence >= 0.6 → duplicate (update existing)
- Confidence < 0.6 → different (create new)

CRITICAL: When in doubt, treat as DUPLICATE. Better to update than create duplicate.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      isDuplicate: result.is_duplicate,
      confidence: result.confidence,
      reasoning: result.reasoning,
      existingRequestId: result.existing_request_id
    };
  } catch (error) {
    console.error("[Pre-Action Deduplication] AI analysis error:", error);
    // On error, be conservative and don't mark as duplicate
    return {
      isDuplicate: false,
      confidence: 0.0,
      reasoning: "Analysis failed",
      existingRequestId: null
    };
  }
}

/**
 * Execute action extracted from AI response
 * @param {Object} action - Action object with type and details
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @param {Number} threadId - Thread ID
 * @param {Number} messageId - Message ID
 * @param {String} userMessage - Original user message (for escalation detection)
 * @returns {Object} Execution result
 */
async function executeAction(action, tenantId, propertyId, threadId, messageId, userMessage) {
  switch (action.action) {
    case "maintenance_request":
      // LAYER 0: Pre-action duplicate check
      const duplicateCheck = await preActionDuplicateCheck(
        action,
        tenantId,
        propertyId,
        messageId,
        userMessage  // Pass userMessage for escalation detection
      );

      if (duplicateCheck) {
        console.log(`[Action Execution] Duplicate detected, updating existing request ${duplicateCheck.requestId}`);

        // Use suggested priority from escalation detection if available
        const priority = duplicateCheck.suggestedPriority || action.priority;

        // Update existing request instead of creating new one
        return await updateExistingRequest(
          duplicateCheck.requestId,
          priority,
          action.description,
          tenantId,
          propertyId,
          duplicateCheck.type === 'ai_provided' ? 'ai-provided' : 'pre-action-check'
        );
      }

      // LAYER 0.5: Semantic similarity check (no time limit)
      const semanticCheck = await checkSemanticSimilarity(
        tenantId,
        propertyId,
        action.description
      );

      if (semanticCheck) {
        console.log(`[Action Execution] Semantic duplicate detected, updating request ${semanticCheck.request.id}`);

        // Update existing request instead of creating new one
        return await updateExistingRequest(
          semanticCheck.request.id,
          action.priority,
          action.description,
          tenantId,
          propertyId,
          'semantic-similarity'
        );
      }

      // No duplicate detected, proceed with creation
      console.log(`[Action Execution] No duplicate detected, creating new request`);
      return await createMaintenanceRequest(
        action,
        tenantId,
        propertyId,
        threadId,
        messageId
      );

    case "alert_manager":
      return await alertManager(action, tenantId, propertyId);

    default:
      console.warn("Unknown action type:", action.action);
      return { status: "unknown_action" };
  }
}

/**
 * Update existing maintenance request with new priority/description
 */
async function updateExistingRequest(requestId, priority, description, tenantId, propertyId, deduplicationLayer = 'unknown') {
  // Load existing request
  const existingResult = await db.query(
    "SELECT * FROM maintenance_requests WHERE id = $1",
    [requestId]
  );

  if (existingResult.rows.length === 0) {
    throw new Error(`Maintenance request ${requestId} not found`);
  }

  const existingRequest = existingResult.rows[0];

  // Check if priority changed
  const isEscalation = priority === 'emergency' && existingRequest.priority !== 'emergency';
  const isDeescalation = priority !== 'emergency' && existingRequest.priority === 'emergency';

  console.log(`[Update Existing Request] Request ID: ${requestId}`);
  console.log(`  Previous priority: ${existingRequest.priority}, New priority: ${priority}`);
  console.log(`  Deduplication layer: ${deduplicationLayer}`);
  console.log(`  Action type: ${isEscalation ? 'escalation' : (isDeescalation ? 'de-escalation' : 'update')}`);

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  if (description) {
    updateFields.push(`issue_description = $${paramIndex}`);
    updateValues.push(description);
    paramIndex++;
  }

  if (priority) {
    updateFields.push(`priority = $${paramIndex}`);
    updateValues.push(priority);
    paramIndex++;
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(requestId);

  const result = await db.query(
    `UPDATE maintenance_requests
     SET ${updateFields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    updateValues
  );

  const updatedRequest = result.rows[0];

  // Handle escalation/de-escalation notifications
  if (isEscalation) {
    console.log(`[Maintenance Request] Escalated request ${requestId} to emergency`);
    await notifyEscalation(updatedRequest, tenantId, propertyId);
  } else if (isDeescalation) {
    console.log(`[Maintenance Request] De-escalated request ${requestId} to ${priority}`);
  }

  return {
    type: "maintenance_request",
    request_id: requestId,
    priority,
    action: isEscalation ? 'escalated' : (isDeescalation ? 'de-escalated' : 'updated'),
    existing_request: true,
    deduplication_layer: deduplicationLayer,
  };
}

/**
 * Notify manager of escalated maintenance request
 */
async function notifyEscalation(maintenanceRequest, tenantId, propertyId) {
  // Load tenant and property details
  const tenantResult = await db.query(
    "SELECT * FROM tenants WHERE id = $1",
    [tenantId]
  );
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId]
  );

  if (tenantResult.rows.length === 0 || propertyResult.rows.length === 0) {
    return;
  }

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Load admin user profile
  const adminUserResult = await db.query(
    "SELECT id, email, phone FROM users WHERE id = 1"
  );
  const adminUser = adminUserResult.rows[0];

  // Send emergency notification
  const result = await notificationService.notifyManagerOfEmergency(
    `Maintenance request escalated to emergency: ${maintenanceRequest.issue_description}`,
    tenant,
    property,
    adminUser ? adminUser.phone : property.owner_phone,
    adminUser ? adminUser.email : property.owner_email,
    adminUser ? adminUser.id : null
  );

  console.log(`Escalation notification sent: ${result.success ? "SUCCESS" : "FAILED"}`);
}

/**
 * Create maintenance request from AI action with cross-thread deduplication
 */
async function createMaintenanceRequest(action, tenantId, propertyId, threadId, messageId) {
  const { priority, description, existing_request_id } = action;

  if (!priority || !description) {
    throw new Error("Missing required fields for maintenance request");
  }

  // LAYER 1: Check if AI explicitly identified an existing request
  if (existing_request_id) {
    console.log(`[Layer 1: AI Reference] AI identified existing request ${existing_request_id}, updating instead of creating new`);
    return await updateExistingRequest(
      existing_request_id,
      priority,
      description,
      tenantId,
      propertyId,
      'ai-provided'
    );
  }

  // LAYER 2: Rule-based duplicate detection (fast, reliable fallback)
  const ruleBasedDuplicate = await detectDuplicateByRules(
    tenantId,
    propertyId,
    description,
    priority
  );

  if (ruleBasedDuplicate && ruleBasedDuplicate.isDuplicate) {
    const existingRequest = ruleBasedDuplicate.request;
    console.log(`[Layer 2: Rule-Based] Duplicate detected (confidence: ${ruleBasedDuplicate.confidence}), updating request ${existingRequest.id}`);

    // Update existing request
    const result = await db.query(
      `UPDATE maintenance_requests
       SET priority = $1,
           issue_description = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [priority, description, existingRequest.id]
    );

    const updatedRequest = result.rows[0];

    // Check for escalation/de-escalation
    const isEscalation = priority === 'emergency' && existingRequest.priority !== 'emergency';
    const isDeescalation = priority !== 'emergency' && existingRequest.priority === 'emergency';

    if (isEscalation) {
      console.log(`[Layer 2: Rule-Based] Escalated request ${existingRequest.id} to emergency`);
      await notifyEscalation(updatedRequest, tenantId, propertyId);
    } else if (isDeescalation) {
      console.log(`[Layer 2: Rule-Based] De-escalated request ${existingRequest.id} to ${priority}`);
    }

    return {
      type: "maintenance_request",
      request_id: existingRequest.id,
      priority,
      action: isEscalation ? 'escalated' : (isDeescalation ? 'de-escalated' : 'updated'),
      existing_request: true,
      deduplication_layer: 'rule-based',
      confidence: ruleBasedDuplicate.confidence,
      reasoning: ruleBasedDuplicate.reasoning
    };
  }

  // LAYER 3: AI-based cross-thread deduplication (semantic analysis)
  const similarRequest = await checkForSimilarMaintenanceRequest(
    tenantId,
    threadId,
    description, // Use AI response description as context
    priority,
    description,
    propertyId
  );

  if (similarRequest && similarRequest.isDuplicate) {
    const existingRequest = similarRequest.request;

    // Handle cross-thread duplicates using the new logic
    if (!similarRequest.isSameThread) {
      // Cross-thread duplicate - use handleCrossThreadDuplicate
      const result = await handleCrossThreadDuplicate(
        existingRequest,
        { priority, description },
        similarRequest,
        propertyId,
        tenantId,
        messageId
      );

      // If we created a linked request, we still need to notify the manager
      if (result.action === "linked" || result.action === "created") {
        const tenantResult = await db.query("SELECT * FROM tenants WHERE id = $1", [tenantId]);
        const propertyResult = await db.query("SELECT * FROM properties WHERE id = $1", [propertyId]);
        const tenant = tenantResult.rows[0];
        const property = propertyResult.rows[0];

        // Load the created request for notification
        const createdRequest = await db.query(
          "SELECT * FROM maintenance_requests WHERE id = $1",
          [result.request_id]
        );

        const notificationResult = await notificationService.notifyManagerOfMaintenanceRequest(
          createdRequest.rows[0],
          tenant,
          property
        );

        console.log(`Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`);

        return {
          type: "maintenance_request",
          request_id: result.request_id,
          priority,
          action: result.action,
          is_duplicate: result.is_duplicate,
          related_to: result.related_to,
          duplicate_reason: result.duplicate_reason,
          notification: notificationResult,
        };
      }

      // For "updated" action, check if we need to escalate/de-escalate
      if (result.action === "updated") {
        const isEscalation = priority === 'emergency' && existingRequest.priority !== 'emergency';
        const isDeescalation = priority !== 'emergency' && existingRequest.priority === 'emergency';

        if (isEscalation) {
          console.log(`[Maintenance Request] Escalated request ${existingRequest.id} to emergency`);
          return {
            type: "maintenance_request",
            request_id: existingRequest.id,
            priority,
            action: 'escalated',
            existing_request: true,
            deduplication_layer: 'cross-thread-ai',
          };
        } else if (isDeescalation) {
          console.log(`[Maintenance Request] De-escalated request ${existingRequest.id} to ${priority}`);
          return {
            type: "maintenance_request",
            request_id: existingRequest.id,
            priority,
            action: 'de-escalated',
            existing_request: true,
            deduplication_layer: 'cross-thread-ai',
          };
        }

        return {
          type: "maintenance_request",
          request_id: existingRequest.id,
          priority,
          action: result.action,
          existing_request: true,
          deduplication_layer: 'cross-thread-ai',
        };
      }
    }

    // Same-thread duplicate - handle escalation/de-escalation
    const isEscalation = priority === 'emergency' && existingRequest.priority !== 'emergency';
    const isDeescalation = priority !== 'emergency' && existingRequest.priority === 'emergency';

    if (isEscalation) {
      // Escalate: Update priority to emergency
      await db.query(
        `UPDATE maintenance_requests
           SET priority = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
        ['emergency', existingRequest.id]
      );

      console.log(`[Maintenance Request] Escalated request ${existingRequest.id} to emergency`);
      return {
        type: "maintenance_request",
        request_id: existingRequest.id,
        priority,
        action: 'escalated',
        existing_request: true,
        deduplication_layer: 'ai-based',
      };
    } else if (isDeescalation) {
      // De-escalate: Update priority from emergency
      const newPriority = priority || 'normal'; // Default to normal if not specified

      await db.query(
        `UPDATE maintenance_requests
           SET priority = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
        [newPriority, existingRequest.id]
      );

      console.log(`[Maintenance Request] De-escalated request ${existingRequest.id} to ${newPriority}`);
      return {
        type: "maintenance_request",
        request_id: existingRequest.id,
        priority: newPriority,
        action: 'de-escalated',
        existing_request: true,
        deduplication_layer: 'ai-based',
      };
    } else {
      // Same issue, same priority - just acknowledge
      console.log(`[Maintenance Request] Same issue detected, skipping duplicate creation. Returning existing request: ${existingRequest.id}`);
      return {
        type: "maintenance_request",
        request_id: existingRequest.id,
        priority,
        status: "duplicate",
        existing_request: true,
        deduplication_layer: 'ai-based',
      };
    }
  }

  // LAYER 4: Create new request (no duplicate found in any layer)
  const result = await db.query(
    `INSERT INTO maintenance_requests
       (property_id, tenant_id, message_id, issue_description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
    [propertyId, tenantId, messageId, description, priority]
  );

  const maintenanceRequest = result.rows[0];

  // Load tenant and property details
  const tenantResult = await db.query(
    "SELECT * FROM tenants WHERE id = $1",
    [tenantId]
  );
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId]
  );

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Load admin user profile for notification
  const adminUserResult = await db.query(
    "SELECT id, email, phone FROM users WHERE id = 1"
  );
  const adminUser = adminUserResult.rows[0];

  // Notify manager about new maintenance request
  const notificationResult = await notificationService.notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property,
    adminUser ? adminUser.phone : property.owner_phone,
    adminUser ? adminUser.email : property.owner_email,
    adminUser ? adminUser.id : null
  );

  console.log(`Created maintenance request: ${maintenanceRequest.id} with priority: ${priority}`);
  console.log(`Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`);

  return {
    type: "maintenance_request",
    request_id: maintenanceRequest.id,
    priority,
    notification: notificationResult,
  };
}

/**
 * Alert property manager about emergency or urgent issue
 */
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;

  console.log(`ALERT MANAGER: ${urgency} - ${reason}`);
  console.log(`Tenant ID: ${tenantId}, Property ID: ${propertyId}`);

  // Load tenant and property details for notification
  const tenantResult = await db.query(
    "SELECT * FROM tenants WHERE id = $1",
    [tenantId]
  );
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId]
  );

  if (tenantResult.rows.length === 0 || propertyResult.rows.length === 0) {
    throw new Error("Tenant or property not found");
  }

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Load admin user profile for notification
  const adminUserResult = await db.query(
    "SELECT id, email, phone FROM users WHERE id = 1"
  );
  const adminUser = adminUserResult.rows[0];

  // Send emergency notification via notification service
  const result = await notificationService.notifyManagerOfEmergency(
    reason,
    tenant,
    property,
    adminUser ? adminUser.phone : property.owner_phone,
    adminUser ? adminUser.email : property.owner_email,
    adminUser ? adminUser.id : null
  );

  console.log(`Emergency alert sent: ${result.success ? "SUCCESS" : "FAILED"}`);

  return {
    type: "alert_manager",
    urgency,
    reason,
    notification: result,
  };
}

/**
 * GET /api/messages/:tenantId/history
 * Get conversation history for a tenant
 */
router.get("/:tenantId/history", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 20 } = req.query;

    const result = await db.query(
      `SELECT * FROM messages
       WHERE tenant_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [tenantId, parseInt(limit)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get conversation history error:", error);
    res.status(500).json({ error: "Failed to fetch conversation history" });
  }
});

module.exports = router;
module.exports.updateExistingRequest = updateExistingRequest;
module.exports.notifyEscalation = notifyEscalation;
module.exports.createMaintenanceRequest = createMaintenanceRequest;
module.exports.extractKeywords = extractKeywords;
module.exports.calculateKeywordOverlap = calculateKeywordOverlap;
