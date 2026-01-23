const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const router = express.Router();

// Get all maintenance requests with optional filters
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status, priority, property_id } = req.query;

    let query = `
      SELECT 
        mr.*,
        t.name as tenant_name,
        p.address as property_address
      FROM maintenance_requests mr
      LEFT JOIN tenants t ON mr.tenant_id = t.id
      LEFT JOIN properties p ON mr.property_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND mr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND mr.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (property_id) {
      query += ` AND mr.property_id = $${paramIndex}`;
      params.push(property_id);
      paramIndex++;
    }

    query += " ORDER BY mr.created_at DESC";

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get maintenance requests error:", error);
    res.status(500).json({ error: "Failed to fetch maintenance requests" });
  }
});

// Get single maintenance request
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        mr.*,
        t.name as tenant_name,
        p.address as property_address,
        m.message as conversation_message
      FROM maintenance_requests mr
      LEFT JOIN tenants t ON mr.tenant_id = t.id
      LEFT JOIN properties p ON mr.property_id = p.id
      LEFT JOIN messages m ON mr.message_id = m.id
      WHERE mr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get maintenance request error:", error);
    res.status(500).json({ error: "Failed to fetch maintenance request" });
  }
});

// Create new maintenance request
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { property_id, tenant_id, message_id, issue_description, priority } =
      req.body;

    if (!property_id || !tenant_id || !issue_description || !priority) {
      return res
        .status(400)
        .json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO maintenance_requests (property_id, tenant_id, message_id, issue_description, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [property_id, tenant_id, message_id || null, issue_description, priority]
    );

    const maintenanceRequest = result.rows[0];

    // Load tenant and property details for notification
    const tenantResult = await db.query(
      "SELECT * FROM tenants WHERE id = $1",
      [tenant_id]
    );
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [property_id]
    );

    // Load admin user profile for notification
    const adminUserResult = await db.query(
      "SELECT id, email, phone FROM users WHERE id = 1"
    );
    const adminUser = adminUserResult.rows[0];

    if (tenantResult.rows.length > 0 && propertyResult.rows.length > 0) {
      const tenant = tenantResult.rows[0];
      const property = propertyResult.rows[0];

      // Notify manager about new maintenance request
      const notificationResult = await notificationService.notifyManagerOfMaintenanceRequest(
        maintenanceRequest,
        tenant,
        property,
        adminUser ? adminUser.phone : property.owner_phone,
        adminUser ? adminUser.email : property.owner_email
      );

      console.log(`Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`);
    }

    res.status(201).json(maintenanceRequest);
  } catch (error) {
    console.error("Create maintenance request error:", error);
    res.status(500).json({ error: "Failed to create maintenance request" });
  }
});

// Update maintenance request status
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const resolvedAt = status === "resolved" ? "NOW()" : null;

    const result = await db.query(
      `UPDATE maintenance_requests 
       SET status = $1, resolved_at = ${resolvedAt}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update maintenance request status error:", error);
    res.status(500).json({ error: "Failed to update maintenance request status" });
  }
});

// Update maintenance request notes
router.patch("/:id/notes", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({ error: "Notes are required" });
    }

    const result = await db.query(
      `UPDATE maintenance_requests
       SET notes = $1
       WHERE id = $2
       RETURNING *`,
      [notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update maintenance request notes error:", error);
    res.status(500).json({ error: "Failed to update maintenance request notes" });
  }
});

// Update maintenance request priority
router.patch("/:id/priority", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({ error: "Priority is required" });
    }

    // Validate priority value
    const validPriorities = ['emergency', 'urgent', 'normal', 'low'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: "Invalid priority. Must be one of: emergency, urgent, normal, low"
      });
    }

    const result = await db.query(
      `UPDATE maintenance_requests
       SET priority = $1
       WHERE id = $2
       RETURNING *`,
      [priority, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    const updatedRequest = result.rows[0];

    res.json(updatedRequest);
  } catch (error) {
    console.error("Update maintenance request priority error:", error);
    res.status(500).json({ error: "Failed to update maintenance request priority" });
  }
});

// Get related maintenance requests (cross-thread duplicates)
router.get("/:id/related", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get requests that are linked to this one (either direction)
    const result = await db.query(
      `SELECT
         mr.*,
         t.name as tenant_name,
         p.address as property_address,
         ct.subject as thread_subject,
         ct.channel as thread_channel
       FROM maintenance_requests mr
       LEFT JOIN tenants t ON mr.tenant_id = t.id
       LEFT JOIN properties p ON mr.property_id = p.id
       LEFT JOIN messages m ON mr.message_id = m.id
       LEFT JOIN conversation_threads ct ON m.thread_id = ct.id
       WHERE mr.related_request_id = $1
          OR mr.id = (SELECT related_request_id FROM maintenance_requests WHERE id = $1)
       ORDER BY mr.created_at DESC`,
      [id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get related maintenance requests error:", error);
    res.status(500).json({ error: "Failed to fetch related requests" });
  }
});

// Delete maintenance request
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM maintenance_requests WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json({ message: "Maintenance request deleted successfully" });
  } catch (error) {
    console.error("Delete maintenance request error:", error);
    res.status(500).json({ error: "Failed to delete maintenance request" });
  }
});

module.exports = router;
