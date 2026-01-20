const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const twilio = require("../config/twilio");
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

    // Load conversation history (last 10 messages)
    const historyResult = await db.query(
      `SELECT message, response 
       FROM conversations 
       WHERE tenant_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 10`,
      [tenant.id]
    );

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(
      historyResult.rows
    );

    // Generate AI response
    const aiResponse = await aiService.generateResponse(
      property,
      tenant,
      conversationHistory,
      Body
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

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
    for (const action of actions) {
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
 * For now, just logs the alert. Will be enhanced in Step 6.
 */
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;

  console.log(`ALERT MANAGER: ${urgency} - ${reason}`);
  console.log(`Tenant ID: ${tenantId}, Property ID: ${propertyId}`);

  // TODO: Implement actual notification via Twilio SMS or Resend email
  // This will be completed in Step 6
  
  return { 
    type: "alert_manager", 
    urgency, 
    reason,
    status: "logged" 
  };
}

module.exports = router;
