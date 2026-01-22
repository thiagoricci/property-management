const express = require("express");
const db = require("../config/database");
const aiService = require("../services/aiService");
const notificationService = require("../services/notificationService");
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

    // Load conversation history (last 15 messages - increased for better context)
    const historyResult = await db.query(
      `SELECT message, response
       FROM messages
       WHERE tenant_id = $1
       ORDER BY timestamp DESC
       LIMIT 15`,
      [tenant_id]
    );

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

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(
      historyResult.rows
    );

    // Generate AI response with open maintenance requests context
    const aiResponse = await aiService.generateResponse(
      property,
      tenant,
      conversationHistory,
      message,
      maintenanceResult.rows
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

    // Deduplicate actions to prevent duplicate maintenance requests
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log conversation to database
    const conversationResult = await db.query(
      `INSERT INTO messages (tenant_id, channel, message, response, ai_actions, timestamp, message_type)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'user_message')
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
    for (const action of deduplicatedActions) {
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

    // Strip JSON from response for user display
    const cleanResponse = aiService.stripJSONFromResponse(aiResponse);

    res.json({
      success: true,
      response: aiResponse,
      response_display: cleanResponse,
      actions: executedActions,
      deduplicated_from: actions.length,
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

  // Create maintenance request in database
  const result = await db.query(
    `INSERT INTO maintenance_requests
       (property_id, tenant_id, message_id, issue_description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
    [propertyId, tenantId, conversationId, description, priority]
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

  // Notify manager about new maintenance request
  const notificationResult = await notificationService.notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property
  );

  console.log(`Created maintenance request: ${maintenanceRequest.id} with priority: ${priority}`);
  console.log(`Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`);

  // Send confirmation to tenant
  const confirmationMessage = buildTenantConfirmation(priority);
  await notificationService.sendTenantConfirmation(
    tenant.phone,
    tenant.email,
    confirmationMessage,
    "sms" // Default to SMS for immediate confirmation
  );

  return {
    type: "maintenance_request",
    request_id: maintenanceRequest.id,
    priority,
    notification: notificationResult,
  };
}

/**
 * Build tenant confirmation message
 */
function buildTenantConfirmation(priority) {
  const messages = {
    emergency: "🚨 EMERGENCY: Your report has been received and your property manager has been notified immediately. If this is a life-threatening emergency, please call 911.",
    urgent: "⚠️ Your urgent request has been received and your property manager has been notified. They will address this as soon as possible.",
    normal: "✅ Your maintenance request has been received. Your property manager has been notified and will review it shortly.",
    low: "📝 Your request has been logged. Your property manager will review it at their earliest convenience.",
  };

  return messages[priority] || messages.normal;
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
