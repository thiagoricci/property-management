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

    // Get open maintenance requests
    const openRequestsResult = await db.query(
      "SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'open'"
    );
    const openRequests = parseInt(openRequestsResult.rows[0].count);

    // Get urgent/emergency requests
    const urgentRequestsResult = await db.query(
      "SELECT COUNT(*) as count FROM maintenance_requests WHERE priority IN ('urgent', 'emergency') AND status != 'resolved'"
    );
    const urgentRequests = parseInt(urgentRequestsResult.rows[0].count);

    // Get recent conversations
    const recentConversationsResult = await db.query(`
      SELECT 
        c.*,
        t.name as tenant_name
      FROM conversations c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      ORDER BY c.timestamp DESC
      LIMIT 10
    `);

    res.json({
      total_properties: totalProperties,
      total_tenants: totalTenants,
      open_requests: openRequests,
      urgent_requests: urgentRequests,
      recent_conversations: recentConversationsResult.rows,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

module.exports = router;
