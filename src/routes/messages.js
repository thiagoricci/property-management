const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const router = express.Router();

/**
 * POST /api/messages
 * Receive tenant message and get AI response
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

    // Load conversation history (last 10 messages)
    const historyResult = await db.query(
      `SELECT message, response 
       FROM conversations 
       WHERE tenant_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 10`,
      [tenant_id]
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
      message
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

    // Log conversation to database
    const conversationResult = await db.query(
      `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        tenant_id,
        channel || "api",
        message,
        aiResponse,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ]
    );

    const savedConversation = conversationResult.rows[0];

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    for (const action of actions) {
      try {
        const result = await executeAction(
          action,
          tenant_id,
          property ? property.id : null,
          savedConversation.id
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({ ...action, status: "failed", error: error.message });
      }
    }

    res.json({
      success: true,
      response: aiResponse,
      actions: executedActions,
      conversation: savedConversation,
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
 * Alert property manager (placeholder for future implementation)
 */
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;

  console.log(`ALERT MANAGER: ${urgency} - ${reason}`);
  console.log(`Tenant ID: ${tenantId}, Property ID: ${propertyId}`);

  // TODO: Implement actual notification via Twilio SMS or Resend email
  // For now, just log it
  
  return { 
    type: "alert_manager", 
    urgency, 
    reason,
    status: "logged" 
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
      `SELECT * FROM conversations 
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
