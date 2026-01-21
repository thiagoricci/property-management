 const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const twilio = require("../config/twilio");
const resend = require("../config/resend");
const notificationService = require("../services/notificationService");
const emailParser = require("../utils/emailParser");
const attachmentHandler = require("../utils/attachmentHandler");
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
      
      // Send response asynchronously (don't wait for it)
      twilio.sendSMS(From, unrecognizedMessage).catch(err => {
        console.error("Failed to send unrecognized message:", err);
      });

      // Return TwiML response immediately
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${unrecognizedMessage}</Message>
        </Response>`
      );
    }

    const tenant = tenantResult.rows[0];
    console.log(`Found tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Load property information
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [tenant.property_id]
    );

    const property = propertyResult.rows[0] || null;

    // Load conversation history (last 15 messages - increased for better context)
    const historyResult = await db.query(
      `SELECT message, response 
       FROM conversations 
       WHERE tenant_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 15`,
      [tenant.id]
    );

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

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(
      historyResult.rows
    );

    // Generate AI response with open maintenance requests context
    const aiResponse = await aiService.generateResponse(
      property,
      tenant,
      conversationHistory,
      Body,
      maintenanceResult.rows
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

    // Deduplicate actions to prevent duplicate maintenance requests
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log conversation to database
    const conversationResult = await db.query(
      `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        tenant.id,
        "sms",
        Body,
        aiResponse,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ]
    );

    const savedConversation = conversationResult.rows[0];
    console.log(`Saved conversation: ${savedConversation.id}`);

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          savedConversation.id
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({ ...action, status: "failed", error: error.message });
      }
    }

    // Send AI response back via SMS
    // Clean up the response (remove JSON action blocks for SMS)
    const cleanResponse = cleanupResponseForSMS(aiResponse);
    
    try {
      await twilio.sendSMS(From, cleanResponse);
      console.log(`Sent SMS response to ${From}`);
    } catch (error) {
      console.error("Failed to send SMS response:", error);
      // Don't fail the webhook if SMS sending fails
    }

    // Return TwiML response to acknowledge receipt
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

    // Load conversation history (last 15 messages)
    const historyResult = await db.query(
      `SELECT message, response
       FROM conversations
       WHERE tenant_id = $1
       ORDER BY timestamp DESC
       LIMIT 15`,
      [tenant.id]
    );

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

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(
      historyResult.rows
    );

    // Generate AI response with context
    const aiResponse = await aiService.generateResponse(
      property,
      tenant,
      conversationHistory,
      messageBody,
      maintenanceResult.rows
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

    // Deduplicate actions to prevent duplicate maintenance requests
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log conversation to database
    const conversationResult = await db.query(
      `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp, subject)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [
        tenant.id,
        "email",
        messageBody,
        aiResponse,
        actions.length > 0 ? JSON.stringify(actions) : null,
        subject || null,
      ]
    );

    const savedConversation = conversationResult.rows[0];
    console.log(`Saved conversation: ${savedConversation.id}`);

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
            tenant.id,
            property ? property.id : null,
            savedConversation.id
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
        savedConversation.id,
        db
      );
    }

    // Send AI response via email
    const cleanResponse = aiService.stripJSONFromResponse(aiResponse);
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
      conversation_id: savedConversation.id,
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
 * Check for recent duplicate maintenance requests
 * @param {Number} tenantId - Tenant ID
 * @param {String} priority - Priority level
 * @param {String} description - Issue description
 * @returns {Object|null} Recent duplicate request or null
 */
async function checkForRecentDuplicate(tenantId, priority, description) {
  const result = await db.query(
    `SELECT * FROM maintenance_requests
     WHERE tenant_id = $1
     AND priority = $2
     AND created_at > NOW() - INTERVAL '5 minutes'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, priority]
  );

  if (result.rows.length > 0) {
    const recent = result.rows[0];
    // Simple similarity check: if descriptions share key words
    const recentWords = new Set(recent.issue_description.toLowerCase().split(/\s+/));
    const newWords = new Set(description.toLowerCase().split(/\s+/));
    const intersection = [...recentWords].filter(word => newWords.has(word));

    // If 50%+ words match, consider it a duplicate
    if (intersection.length / Math.max(recentWords.size, newWords.size) >= 0.5) {
      console.log(`[Time-Based Deduplication] Skipping duplicate request for tenant ${tenantId}`);
      console.log(`  Recent: "${recent.issue_description}"`);
      console.log(`  New: "${description}"`);
      console.log(`  Similarity: ${(intersection.length / Math.max(recentWords.size, newWords.size) * 100).toFixed(0)}%`);
      return recent;
    }
  }

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
 * @param {Number} conversationId - Conversation ID
 * @returns {Object} Execution result
 */
async function executeAction(action, tenantId, propertyId, conversationId) {
  switch (action.action) {
    case "maintenance_request":
      return await createMaintenanceRequest(
        action,
        tenantId,
        propertyId,
        conversationId
      );

    case "alert_manager":
      return await alertManager(action, tenantId, propertyId);

    default:
      console.warn("Unknown action type:", action.action);
      return { status: "unknown_action" };
  }
}

/**
 * Create maintenance request from AI action
 */
async function createMaintenanceRequest(action, tenantId, propertyId, conversationId) {
  const { priority, description } = action;

  if (!priority || !description) {
    throw new Error("Missing required fields for maintenance request");
  }

  // Check for recent duplicate maintenance requests
  const recentDuplicate = await checkForRecentDuplicate(tenantId, priority, description);
  if (recentDuplicate) {
    console.log(`[Maintenance Request] Skipping duplicate creation. Returning existing request: ${recentDuplicate.id}`);
    return {
      type: "maintenance_request",
      request_id: recentDuplicate.id,
      priority,
      status: "duplicate",
      existing_request: true,
    };
  }

  const result = await db.query(
    `INSERT INTO maintenance_requests
       (property_id, tenant_id, conversation_id, issue_description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
    [propertyId, tenantId, conversationId, description, priority]
  );

  console.log(`Created maintenance request: ${result.rows[0].id} with priority: ${priority}`);
  
  return {
    type: "maintenance_request",
    request_id: result.rows[0].id,
    priority
  };
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

  // Send emergency notification via notification service
  const result = await notificationService.notifyManagerOfEmergency(
    reason,
    tenant,
    property
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
