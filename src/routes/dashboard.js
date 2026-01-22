const express = require("express");
const db = require("../config/database");
const router = express.Router();

// Get dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    // Get total properties
    const propertiesResult = await db.query(
      "SELECT COUNT(*) as count FROM properties"
    );
    const totalProperties = parseInt(propertiesResult.rows[0].count);

    // Get total tenants
    const tenantsResult = await db.query("SELECT COUNT(*) as count FROM tenants");
    const totalTenants = parseInt(tenantsResult.rows[0].count);

    // Get total maintenance requests (all requests, not just open)
    const totalRequestsResult = await db.query(
      "SELECT COUNT(*) as count FROM maintenance_requests"
    );
    const totalRequests = parseInt(totalRequestsResult.rows[0].count);

    // Get total conversation threads (not individual messages)
    const totalConversationsResult = await db.query(
      "SELECT COUNT(*) as count FROM conversation_threads"
    );
    const totalConversations = parseInt(totalConversationsResult.rows[0].count);
 
    res.json({
      total_properties: totalProperties,
      total_tenants: totalTenants,
      total_requests: totalRequests,
      total_conversations: totalConversations,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// Get recent conversations for dashboard
router.get("/recent-conversations", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        m.id,
        m.tenant_id,
        m.channel,
        m.message,
        m.response,
        m.timestamp,
        m.subject,
        t.name as tenant_name,
        p.address as property_address,
        mr.priority as urgency,
        mr.status as request_status
      FROM messages m
      LEFT JOIN tenants t ON m.tenant_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN maintenance_requests mr ON m.id = mr.message_id
      ORDER BY m.timestamp DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Recent conversations error:", error);
    res.status(500).json({ error: "Failed to fetch recent conversations" });
  }
});

// Get recent maintenance requests for dashboard
router.get("/recent-requests", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        mr.id,
        mr.property_id,
        mr.tenant_id,
        mr.issue_description,
        mr.priority,
        mr.status,
        mr.created_at,
        mr.resolved_at,
        t.name as tenant_name,
        p.address as property_address
      FROM maintenance_requests mr
      LEFT JOIN tenants t ON mr.tenant_id = t.id
      LEFT JOIN properties p ON mr.property_id = p.id
      ORDER BY mr.created_at DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Recent requests error:", error);
    res.status(500).json({ error: "Failed to fetch recent requests" });
  }
});

module.exports = router;
