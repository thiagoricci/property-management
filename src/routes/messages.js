const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
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

    // Load open maintenance requests for context
    const maintenanceResult = await db.query(
      `SELECT issue_description, priority, status
       FROM maintenance_requests
       WHERE tenant_id = $1
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenant_id]
    );

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

      // Check if conversation is resolved
      if (resolutionAnalysis.isResolved && resolutionAnalysis.confidence >= 0.8) {
        console.log(`[Thread Management] Marking thread ${threadId} as resolved`);
        await db.query(
          `UPDATE conversation_threads
            SET status = 'resolved', resolved_at = NOW()
            WHERE id = $1`,
          [threadId]
        );
      }
    } else {
      // Create new thread
      const subject = topicAnalysis.newSubject || await aiService.extractSubject(message);

      const threadResult = await db.query(
        `INSERT INTO conversation_threads
           (tenant_id, property_id, subject, channel, created_at, last_activity_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
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
    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          threadId, // Pass threadId
          savedResponse.id  // Pass messageId
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({ ...action, status: "failed", error: error.message });
      }
    }

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

CONFIDENCE THRESHOLDS:
- Confidence >= 0.6 → same issue (stricter for cross-thread)
- Confidence < 0.6 → different issue

EXAMPLES:

Example 1 - Update Existing:
Time gap: 2 hours, Same channel, Same subject
→ should_update_existing: true, action: "update_existing"

Example 2 - Create New Linked:
Time gap: 10 days, Different channel (SMS → email), Same issue
→ should_update_existing: false, action: "create_new_linked"

Example 3 - Create New Independent:
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

      if (result.is_same_issue && result.confidence >= 0.6 && result.existing_request_id) {
        const existingRequest = tenantRequests.rows.find(r => r.id === result.existing_request_id);
        console.log(`[Cross-Thread Deduplication] Duplicate detected! Request ${existingRequest.id} from thread ${existingRequest.thread_id}. Action: ${result.action}`);
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
      };

    default:
      throw new Error(`Unknown action: ${analysisResult.action}`);
  }
}

/**
 * Execute action extracted from AI response
 * @param {Object} action - Action object with type and details
 * @param {Number} tenantId - Tenant ID
 * @param {Number} propertyId - Property ID
 * @param {Number} threadId - Thread ID
 * @param {Number} messageId - Message ID
 * @returns {Object} Execution result
 */
async function executeAction(action, tenantId, propertyId, threadId, messageId) {
  switch (action.action) {
    case "maintenance_request":
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
 * Create maintenance request from AI action with cross-thread deduplication
 */
async function createMaintenanceRequest(action, tenantId, propertyId, threadId, messageId) {
  const { priority, description } = action;

  if (!priority || !description) {
    throw new Error("Missing required fields for maintenance request");
  }

  // Check for similar maintenance requests across all threads
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
          };
        } else if (isDeescalation) {
          console.log(`[Maintenance Request] De-escalated request ${existingRequest.id} to ${priority}`);
          return {
            type: "maintenance_request",
            request_id: existingRequest.id,
            priority,
            action: 'de-escalated',
            existing_request: true,
          };
        }

        return {
          type: "maintenance_request",
          request_id: existingRequest.id,
          priority,
          action: result.action,
          existing_request: true,
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
      };
    }
  }

  // Create new request
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
    adminUser ? adminUser.email : property.owner_email
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
    adminUser ? adminUser.email : property.owner_email
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
