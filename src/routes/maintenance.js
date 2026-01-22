const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
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

    res.status(201).json(result.rows[0]);
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
