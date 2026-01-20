const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Get all conversations with pagination and search
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.*,
        t.name as tenant_name,
        p.address as property_address
      FROM conversations c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR c.message ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    query += " ORDER BY c.timestamp DESC LIMIT $1 OFFSET $2";
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get single conversation with full history
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        c.*,
        t.name as tenant_name,
        t.phone as tenant_phone,
        t.email as tenant_email,
        p.address as property_address
      FROM conversations c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get related maintenance requests
    const maintenanceResult = await db.query(
      "SELECT * FROM maintenance_requests WHERE conversation_id = $1",
      [id]
    );

    res.json({
      ...result.rows[0],
      related_maintenance: maintenanceResult.rows,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Send manual reply to tenant
router.post("/:id/reply", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get original conversation to get tenant info
    const convResult = await db.query(
      "SELECT * FROM conversations WHERE id = $1",
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = convResult.rows[0];

    // Here you would integrate with Twilio/Resend to send the message
    // For now, just log it
    console.log(`Manual reply to tenant ${conversation.tenant_id}: ${message}`);

    res.json({ message: "Reply sent successfully" });
  } catch (error) {
    console.error("Send reply error:", error);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// Toggle flag status of conversation
router.patch("/:id/flag", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { flagged } = req.body;

    if (flagged === undefined) {
      return res.status(400).json({ error: "Flagged status is required" });
    }

    const result = await db.query(
      `UPDATE conversations 
       SET flagged = $1
       WHERE id = $2
       RETURNING *`,
      [flagged, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Flag conversation error:", error);
    res.status(500).json({ error: "Failed to flag conversation" });
  }
});

// Get flagged conversations
router.get("/flagged/list", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.*,
        t.name as tenant_name,
        p.address as property_address
      FROM conversations c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE c.flagged = true
      ORDER BY c.timestamp DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get flagged conversations error:", error);
    res.status(500).json({ error: "Failed to fetch flagged conversations" });
  }
});

module.exports = router;
