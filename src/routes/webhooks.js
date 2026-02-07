const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const twilio = require("../config/twilio");
const resend = require("../config/resend");
const notificationService = require("../services/notificationService");
const emailParser = require("../utils/emailParser");
const attachmentHandler = require("../utils/attachmentHandler");
const OpenAI = require("openai");

/**
 * Fetch user settings from database
 * @param {Number} userId - User ID
 * @returns {Promise<Object|null>} User settings or null
 */
async function getUserSettings(userId) {
  try {
    const result = await db.query(
      "SELECT * FROM user_settings WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return null;
  }
}

/**
 * Get admin user ID
 * @returns {Promise<Number|null>} Admin user ID or null
 */
async function getAdminUserId() {
  try {
    const result = await db.query("SELECT id FROM users ORDER BY id LIMIT 1");
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (error) {
    console.error("Failed to fetch admin user ID:", error);
    return null;
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const router = express.Router();

/**
 * POST /webhooks/twilio/sms
 * Handle incoming SMS messages from Twilio
 * 
 * Twilio sends form data with these fields:
 * - From: Sender phone number (E.164 format)
 * - To: Your Twilio phone number
 * - Body: Message content
 * - MessageSid: Unique message ID
 */
router.post("/twilio/sms", async (req, res) => {
  try {
    // Parse incoming Twilio message
    const { From, To, Body, MessageSid } = req.body;

    // Validate required fields
    if (!From || !Body) {
      console.error("Missing required fields in Twilio webhook");
      return res.status(400).send("Bad Request");
    }

    console.log(`Received SMS from ${From}: ${Body}`);

    // Normalize phone number (remove +, spaces, dashes)
    const normalizedPhone = normalizePhoneNumber(From);

    // Look up tenant by phone number
    const tenantResult = await db.query(
      "SELECT * FROM tenants WHERE phone = $1 OR phone = $2",
      [From, normalizedPhone]
    );

    if (tenantResult.rows.length === 0) {
      // Tenant not recognized - send friendly message
      console.log(`No tenant found for phone: ${From}`);
      const unrecognizedMessage = "Hello! I'm Alice, your AI property manager. I don't recognize your number. If you're a tenant, please contact your property manager to update your phone number.";
      
      // Get admin user ID and fetch user settings
      const adminUserId = await getAdminUserId();
      
      // Send response asynchronously (don't wait for it)
      if (adminUserId) {
        const userSettings = await getUserSettings(adminUserId);
        if (userSettings && userSettings.twilio_account_sid && userSettings.twilio_auth_token_encrypted) {
          twilio.sendSMSWithUserSettings(From, unrecognizedMessage, userSettings).catch(err => {
            console.error("Failed to send unrecognized message:", err);
          });
        } else {
          // Fallback to legacy .env configuration
          console.warn("Twilio not configured in user settings, using legacy .env configuration");
          twilio.sendSMSLegacy(From, unrecognizedMessage).catch(err => {
            console.error("Failed to send unrecognized message:", err);
          });
        }
      } else {
        // No admin user, use legacy .env configuration
        console.warn("No admin user found, using legacy .env configuration");
        twilio.sendSMSLegacy(From, unrecognizedMessage).catch(err => {
          console.error("Failed to send unrecognized message:", err);
        });
      }

      // Return 200 OK - we've already sent the SMS via async call
      // Don't return TwiML to avoid sending duplicate messages
      return res.status(200).send("OK");
    }

    const tenant = tenantResult.rows[0];
    console.log(`Found tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Load property information
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [tenant.property_id]
    );

    const property = propertyResult.rows[0] || null;

    // Find active thread for this tenant (SMS channel)
    const activeThreadResult = await db.query(
      `SELECT * FROM conversation_threads
       WHERE tenant_id = $1
        AND channel = 'sms'
        AND status = 'active'
        ORDER BY last_activity_at DESC
        LIMIT 1`,
      [tenant.id]
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

    // Load open maintenance requests for context (include ID for AI reference)
    const maintenanceResult = await db.query(
      `SELECT id, issue_description, priority, status
       FROM maintenance_requests
       WHERE tenant_id = $1
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenant.id]
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
      [tenant.id, activeThread ? activeThread.id : null]
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
        const analysis = await aiService.analyzeClarificationResponse(Body, [openRequest]);

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
            Body, // Use tenant's message as new description
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
             VALUES ($1, $2, 'sms', $3, 'user_message', NOW())
             RETURNING *`,
            [activeThread ? activeThread.id : null, tenant.id, Body]
          );

          const responseResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
             VALUES ($1, $2, 'sms', $3, $4, $5, 'ai_response', NOW())
             RETURNING *`,
            [
              activeThread ? activeThread.id : null,
              tenant.id,
              Body,
              confirmationResponse,
              null // No actions for confirmation
            ]
          );

          // Update thread activity
          if (activeThread) {
            await db.query(
              `UPDATE conversation_threads
               SET last_activity_at = NOW()
               WHERE id = $1`,
              [activeThread.id]
            );
          }

          const cleanResponse = cleanupResponseForSMS(confirmationResponse);

          // Return TwiML response
          return res.type("text/xml").send(
            `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Message>${cleanResponse}</Message>
            </Response>`
          );
        } else {
          // Different issue - create new request
          console.log(`[Clarification Flow] Tenant confirmed different issue, creating new request`);

          // Extract actions from AI to get maintenance request details
          const tempAnalysis = await aiService.generateResponseWithAnalysis(
            property,
            tenant,
            conversationHistory,
            Body,
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
                activeThread ? activeThread.id : null,
                null // No message ID yet
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
             VALUES ($1, $2, 'sms', $3, 'user_message', NOW())
             RETURNING *`,
            [activeThread ? activeThread.id : null, tenant.id, Body]
          );

          const responseResult = await db.query(
            `INSERT INTO messages
             (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
             VALUES ($1, $2, 'sms', $3, $4, $5, 'ai_response', NOW())
             RETURNING *`,
            [
              activeThread ? activeThread.id : null,
              tenant.id,
              Body,
              confirmationResponse,
              JSON.stringify(actions)
            ]
          );

          // Update thread activity
          if (activeThread) {
            await db.query(
              `UPDATE conversation_threads
               SET last_activity_at = NOW()
               WHERE id = $1`,
              [activeThread.id]
            );
          }

          const cleanResponse = cleanupResponseForSMS(confirmationResponse);

          // Return TwiML response
          return res.type("text/xml").send(
            `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Message>${cleanResponse}</Message>
            </Response>`
          );
        }
      }
    }

    // No pending clarification - check if we should ask one
    // Only ask if: 1) there are open maintenance requests, 2) not an emergency, 3) clarification hasn't been asked yet
    const shouldAskClarification = maintenanceResult.rows.length > 0 &&
                                   !aiService.isEmergency(Body) &&
                                   (!activeThread || activeThread.clarification_asked === false);

    if (shouldAskClarification) {
      console.log(`[Clarification Flow] Found ${maintenanceResult.rows.length} open maintenance request(s) and clarification not asked yet`);

      // Generate clarification question
      const clarification = await aiService.generateClarificationQuestion(
        tenant.name,
        maintenanceResult.rows,
        Body
      );

      if (clarification.shouldAsk) {
        console.log(`[Clarification Flow] Asking clarification: "${clarification.question}"`);

        // Create new thread if needed for clarification
        let clarificationThreadId = activeThread ? activeThread.id : null;
        let isNewThread = false;

        if (!clarificationThreadId) {
          const subject = await aiService.extractSubject(Body);
          const threadResult = await db.query(
            `INSERT INTO conversation_threads
             (tenant_id, property_id, subject, channel, created_at, last_activity_at, clarification_asked)
             VALUES ($1, $2, $3, 'sms', NOW(), NOW(), true)
             RETURNING *`,
            [tenant.id, property ? property.id : null, subject]
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
           VALUES ($1, $2, $3, 'sms', 'pending', $4, NOW(), NOW() + INTERVAL '24 hours')
           RETURNING *`,
          [
            tenant.id,
            clarificationThreadId,
            maintenanceResult.rows[0].id, // Most recent request
            clarification.question,
          ]
        );

        // Log messages
        const messageResult = await db.query(
          `INSERT INTO messages
           (thread_id, tenant_id, channel, message, message_type, timestamp)
           VALUES ($1, $2, 'sms', $3, 'user_message', NOW())
           RETURNING *`,
          [clarificationThreadId, tenant.id, Body]
        );

        const responseResult = await db.query(
          `INSERT INTO messages
           (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
           VALUES ($1, $2, 'sms', $3, $4, $5, 'ai_response', NOW())
           RETURNING *`,
          [
            clarificationThreadId,
            tenant.id,
            Body,
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

        const cleanResponse = cleanupResponseForSMS(clarification.question);

        // Return TwiML response
        return res.type("text/xml").send(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Message>${cleanResponse}</Message>
          </Response>`
        );
      }
    } else if (maintenanceResult.rows.length > 0 && !aiService.isEmergency(Body)) {
      console.log(`[Clarification Flow] Skipping clarification - already asked for this thread`);
    }

    // No clarification needed - process normally
    console.log(`[Clarification Flow] No clarification needed, processing normally`);

    // Generate AI response with thread analysis
    const analysis = await aiService.generateResponseWithAnalysis(
      property,
      tenant,
      conversationHistory,
      Body,
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
      const subject = topicAnalysis.newSubject || await aiService.extractSubject(Body);

      const threadResult = await db.query(
        `INSERT INTO conversation_threads
           (tenant_id, property_id, subject, channel, created_at, last_activity_at, clarification_asked)
           VALUES ($1, $2, $3, 'sms', NOW(), NOW(), false)
           RETURNING *`,
        [tenant.id, property ? property.id : null, subject]
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
       VALUES ($1, $2, 'sms', $3, 'user_message', NOW())
       RETURNING *`,
      [threadId, tenant.id, Body]
    );

    const savedMessage = messageResult.rows[0];

    // Log AI response
    const responseResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
       VALUES ($1, $2, 'sms', $3, $4, $5, 'ai_response', NOW())
       RETURNING *`,
      [
        threadId,
        tenant.id,
        Body, // Store original message for reference
        response,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ]
    );

    const savedResponse = responseResult.rows[0];
    console.log(`Saved messages: ${savedMessage.id} (user), ${savedResponse.id} (AI)`);

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          threadId,
          savedResponse.id
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({ ...action, status: "failed", error: error.message });
      }
    }

    // Return TwiML response to acknowledge receipt and send reply
    // TwiML automatically sends the message, so we don't need to call sendSMS() separately
    const cleanResponse = cleanupResponseForSMS(response);
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${cleanResponse}</Message>
      </Response>`
    );

  } catch (error) {
    console.error("Twilio webhook error:", error);
    
    // Return error TwiML
    res.status(500).type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>I apologize, but I'm having trouble processing your request right now. Please try again later or contact your property manager directly.</Message>
      </Response>`
    );
  }
});

/**
 * POST /webhooks/email/inbound
 * Handle incoming email messages from Resend
 *
 * Resend sends JSON payload with:
 * - from: Sender email address
 * - to: Recipient email address
 * - subject: Email subject line
 * - text: Plain text body
 * - html: HTML body (optional)
 * - attachments: Array of attachment objects
 */
router.post("/email/inbound", async (req, res) => {
  try {
    const { from, to, subject, text, html, attachments } = req.body;

    // Validate required fields
    if (!from || !text) {
      console.error("Missing required fields in email webhook");
      return res.status(400).json({ error: "Bad Request" });
    }

    console.log(`Received email from ${from}: ${subject}`);

    // Extract and normalize email address
    const emailAddress = emailParser.extractEmailAddress(from);
    const normalizedEmail = emailParser.normalizeEmailAddress(emailAddress);

    // Look up tenant by email address
    const tenantResult = await db.query(
      "SELECT * FROM tenants WHERE email = $1 OR email = $2",
      [emailAddress, normalizedEmail]
    );

    if (tenantResult.rows.length === 0) {
      // Tenant not recognized - send friendly email response
      console.log(`No tenant found for email: ${from}`);
      const unrecognizedMessage = emailParser.buildUnrecognizedEmailMessage();

      // Send response asynchronously (don't wait for it)
      resend.sendEmail(from, "Property Manager - Unknown Sender", unrecognizedMessage)
        .catch(err => console.error("Failed to send unrecognized email:", err));

      return res.status(200).json({ status: "unrecognized_sender" });
    }

    const tenant = tenantResult.rows[0];
    console.log(`Found tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Strip email signatures and thread history
    const cleanedBody = emailParser.stripEmailSignatures(text);
    const messageBody = cleanedBody || subject; // Use subject if body is empty

    // Load property information
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [tenant.property_id]
    );

    const property = propertyResult.rows[0] || null;

    // Find active thread for this tenant (email channel)
    const activeThreadResult = await db.query(
      `SELECT * FROM conversation_threads
       WHERE tenant_id = $1
        AND channel = 'email'
        AND status = 'active'
        ORDER BY last_activity_at DESC
        LIMIT 1`,
      [tenant.id]
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
      [tenant.id]
    );

    // Generate AI response with thread analysis
    const analysis = await aiService.generateResponseWithAnalysis(
      property,
      tenant,
      conversationHistory,
      messageBody,
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
      const threadSubject = topicAnalysis.newSubject || await aiService.extractSubject(messageBody);

      const threadResult = await db.query(
        `INSERT INTO conversation_threads
           (tenant_id, property_id, subject, channel, created_at, last_activity_at, clarification_asked)
           VALUES ($1, $2, $3, 'email', NOW(), NOW(), false)
           RETURNING *`,
        [tenant.id, property ? property.id : null, threadSubject]
      );

      threadId = threadResult.rows[0].id;
      isNewThread = true;
      console.log(`[Thread Management] Created new thread ${threadId}: "${threadSubject}"`);
    }

    // Extract actions from AI response
    const actions = aiService.extractActions(response);
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log tenant message
    const messageResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, message_type, timestamp)
       VALUES ($1, $2, 'email', $3, 'user_message', NOW())
       RETURNING *`,
      [threadId, tenant.id, messageBody]
    );

    const savedMessage = messageResult.rows[0];

    // Log AI response
    const responseResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
       VALUES ($1, $2, 'email', $3, $4, $5, 'ai_response', NOW())
       RETURNING *`,
      [
        threadId,
        tenant.id,
        messageBody, // Store original message for reference
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
          threadId,
          savedResponse.id
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({
          ...action,
          status: "failed",
          error: error.message
        });
      }
    }

    // Handle attachments (photos of issues)
    let savedAttachments = [];
    if (attachments && attachments.length > 0) {
      savedAttachments = await attachmentHandler.handleEmailAttachments(
        attachments,
        savedMessage.id,
        db
      );
    }

    // Send AI response via email
    const cleanResponse = aiService.stripJSONFromResponse(response);
    const emailBody = emailParser.buildEmailResponse(cleanResponse, subject);

    try {
      await resend.sendEmail(
        from,
        "Re: " + (subject || "Property Manager Inquiry"),
        emailBody
      );
      console.log(`Sent email response to ${from}`);
    } catch (error) {
      console.error("Failed to send email response:", error);
      // Don't fail webhook if email sending fails
    }

    // Return success response
    res.status(200).json({
      status: "processed",
      thread_id: threadId,
      message_id: savedMessage.id,
      actions: executedActions,
      deduplicated_from: actions.length,
      attachments: savedAttachments.length
    });
  } catch (error) {
    console.error("Email webhook error:", error);
    res.status(500).json({ error: "Failed to process email" });
  }
});

/**
 * Check for similar maintenance requests in same thread
 * @param {Number} tenantId - Tenant ID
 * @param {Number} threadId - Thread ID
 * @param {String} newMessage - New tenant message (for context)
 * @param {String} priority - Priority level
 * @param {String} description - New issue description
 * @returns {Object|null} Similar request or null
 */
async function checkForSimilarMaintenanceRequest(tenantId, threadId, newMessage, priority, description) {
  // Check for open maintenance requests in same thread
  const threadRequests = await db.query(
    `SELECT * FROM maintenance_requests mr
     JOIN messages m ON mr.message_id = m.id
     WHERE m.thread_id = $1
     AND mr.status IN ('open', 'in_progress')
     ORDER BY mr.created_at DESC
     LIMIT 3`,
    [threadId]
  );

  if (threadRequests.rows.length > 0) {
    // Use AI to determine if new message is about same issue
    const existingDescriptions = threadRequests.rows
      .map(req => req.issue_description)
      .join('\n');

    const prompt = `You are analyzing maintenance requests to detect duplicates and prevent duplicate ticket creation.

Existing maintenance requests in this conversation:
${existingDescriptions}

New tenant message: "${newMessage}"
New issue description: "${description}"

Analyze if this new message is about the SAME issue or a DIFFERENT issue.

Return JSON:
{
  "is_same_issue": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "existing_request_id": ID if same issue, else null
}

Guidelines:
- Same issue if: describing same problem, providing more details, confirming issue, escalating, de-escalating
- Different issue if: completely different problem, different location, different property

ESCALATION EXAMPLES (these should be treated as SAME issue):
- "My sink is leaking" → "It's getting worse, water everywhere!" (escalation)
- "No heat in my apartment" → "It's freezing, this is an emergency!" (escalation)
- "The AC isn't working" → "Still no AC, it's really hot in here" (same issue)
- "Kitchen faucet dripping" → "The leak is getting worse" (escalation)

CONFIDENCE THRESHOLDS:
- Confidence >= 0.5 → same issue (be lenient to prevent duplicates)
- Confidence < 0.5 → different issue

IMPORTANT: When in doubt, treat as SAME issue. Better to update an existing request than create a duplicate.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Log deduplication analysis for tracking
      console.log(`[Deduplication Analysis] Thread: ${threadId}, Confidence: ${result.confidence}, Same Issue: ${result.is_same_issue}, Reasoning: ${result.reasoning}`);

      if (result.is_same_issue && result.confidence >= 0.5 && result.existing_request_id) {
        const existingRequest = threadRequests.rows.find(r => r.id === result.existing_request_id);
        console.log(`[Deduplication] Duplicate detected! Reusing request ${existingRequest.id} instead of creating new one.`);
        return {
          request: existingRequest,
          isDuplicate: true,
          confidence: result.confidence,
          reasoning: result.reasoning,
        };
      } else {
        console.log(`[Deduplication] No duplicate found (confidence: ${result.confidence}). Creating new request.`);
      }
    } catch (error) {
      console.error("[Deduplication] AI deduplication error:", error);
      return null;
    }
  }

  // Fallback: return null if no similar requests found
  return null;
}

/**
 * Normalize phone number to consistent format
 * @param {String} phone - Phone number in various formats
 * @returns {String} Normalized phone number
 */
function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  return phone.replace(/\D/g, "");
}

/**
 * Clean up AI response for SMS
 * Remove JSON action blocks and truncate if too long
 * @param {String} response - AI response
 * @returns {String} Cleaned response suitable for SMS
 */
function cleanupResponseForSMS(response) {
  // Remove JSON action blocks
  let cleaned = response.replace(/\{[\s\S]*?\}/g, "").trim();
  
  // Remove specific phrases that indicate maintenance request creation
  // These are the exact phrases we want to remove, not broader patterns
  const phrasesToRemove = [
    /Maintenance Request:?$/gi,  // Only at end of sentence
    /I'll create a maintenance request for your issue\./gi,  // Specific phrase
    /I am creating a maintenance request for your issue\./gi,  // Specific phrase
    /I will create a maintenance request for your issue\./gi,  // Specific phrase
    /I'm creating a maintenance request for your issue\./gi,  // Specific phrase
    /Creating maintenance request for your issue\./gi,  // Specific phrase
    /Maintenance request created for your issue\./gi,  // Specific phrase
  ];

  phrasesToRemove.forEach(regex => {
    cleaned = cleaned.replace(regex, "");
  });

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  
  // Truncate to 1600 characters (Twilio SMS limit)
  if (cleaned.length > 1600) {
    cleaned = cleaned.substring(0, 1597) + "...";
  }
  
  return cleaned;
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
 * Get admin user contact information
 * Falls back to property owner's contact if admin user contact is not available
 * @param {Number} propertyId - Property ID (for fallback to property owner)
 * @returns {Object} Admin user's email and phone
 */
async function getAdminContactInfo(propertyId = null) {
  try {
    // First, try to get admin user contact info
    const adminResult = await db.query(
      "SELECT email, phone FROM users ORDER BY id LIMIT 1"
    );

    let adminEmail = null;
    let adminPhone = null;

    if (adminResult.rows.length > 0) {
      adminEmail = adminResult.rows[0].email;
      adminPhone = adminResult.rows[0].phone;
    }

    // If admin user doesn't have phone/email, try property owner as fallback
    if ((!adminEmail || !adminPhone) && propertyId) {
      console.warn("Admin user contact info incomplete. Trying property owner as fallback.");
      const propertyResult = await db.query(
        "SELECT owner_email, owner_phone FROM properties WHERE id = $1",
        [propertyId]
      );

      if (propertyResult.rows.length > 0) {
        if (!adminEmail) {
          adminEmail = propertyResult.rows[0].owner_email;
        }
        if (!adminPhone) {
          adminPhone = propertyResult.rows[0].owner_phone;
        }
      }
    }

    if (!adminEmail && !adminPhone) {
      console.warn("No contact information available (admin user or property owner)");
    }

    return {
      email: adminEmail,
      phone: adminPhone
    };
  } catch (error) {
    console.error("Error fetching admin contact info:", error);
    return { email: null, phone: null };
  }
}

/**
 * Create maintenance request from AI action
 */
async function createMaintenanceRequest(action, tenantId, propertyId, threadId, messageId) {
  const { priority, description } = action;

  if (!priority || !description) {
    throw new Error("Missing required fields for maintenance request");
  }

  // Check for similar maintenance requests in same thread
  const similarRequest = await checkForSimilarMaintenanceRequest(
    tenantId,
    threadId,
    description, // Use AI response description as context
    priority,
    description
  );

  if (similarRequest && similarRequest.isDuplicate) {
    const existingRequest = similarRequest.request;

    // Determine if this is an escalation or de-escalation
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

  // Get admin user contact information (with property owner fallback)
  const adminContact = await getAdminContactInfo(propertyId);

  if (!adminContact.email && !adminContact.phone) {
    console.warn("No admin contact information available. Cannot send notification.");
  }

  // Notify manager about new maintenance request
  const notificationResult = await notificationService.notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property,
    adminContact.phone,
    adminContact.email
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
 * Alert property manager
 * Sends immediate SMS notification for emergencies
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

  // Get admin user ID for notification
  const adminUserId = await getAdminUserId();

  // Get admin user contact information (with property owner fallback)
  const adminContact = await getAdminContactInfo(propertyId);

  if (!adminContact.email && !adminContact.phone) {
    console.warn("No admin contact information available. Cannot send emergency notification.");
  }

  // Send emergency notification via notification service
  const result = await notificationService.notifyManagerOfEmergency(
    reason,
    tenant,
    property,
    adminContact.phone,
    adminContact.email,
    adminUserId
  );

  console.log(`Emergency alert sent: ${result.success ? "SUCCESS" : "FAILED"}`);

  return {
    type: "alert_manager",
    urgency,
    reason,
    notification: result,
  };
}

module.exports = router;
