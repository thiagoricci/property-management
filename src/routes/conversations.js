const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const aiService = require("../services/aiService");
const router = express.Router();

// Get all conversations with pagination and search
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, tenant_id, page = 1, limit = 20, grouped } = req.query;
    const offset = (page - 1) * limit;

    let query;
    const params = [];
    let paramIndex = 1;

    if (grouped === 'true') {
      query = `
        SELECT * FROM (
          SELECT DISTINCT ON (c.tenant_id)
            c.*,
            t.name as tenant_name,
            t.email as tenant_email,
            p.address as property_address,
            COUNT(*) OVER (PARTITION BY c.tenant_id) as message_count
          FROM conversations c
          LEFT JOIN tenants t ON c.tenant_id = t.id
          LEFT JOIN properties p ON t.property_id = p.id
          WHERE 1=1
      `;
    } else {
      query = `
        SELECT
          c.*,
          t.name as tenant_name,
          t.email as tenant_email,
          p.address as property_address
        FROM conversations c
        LEFT JOIN tenants t ON c.tenant_id = t.id
        LEFT JOIN properties p ON t.property_id = p.id
        WHERE 1=1
      `;
    }

    if (tenant_id) {
      if (grouped === 'true') {
        query += ` AND c.tenant_id = $${paramIndex}`;
      } else {
        query += ` AND c.tenant_id = $${paramIndex}`;
      }
      params.push(parseInt(tenant_id));
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR c.message ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (grouped === 'true') {
      // Close subquery and sort by timestamp
      query += `
        ORDER BY c.tenant_id, c.timestamp DESC
        ) sub
        ORDER BY sub.timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
    } else {
      query += ` ORDER BY c.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    }

    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Strip JSON from responses for user display
    const conversationsWithCleanResponse = result.rows.map(conv => ({
      ...conv,
      response_display: aiService.stripJSONFromResponse(conv.response)
    }));

    res.json(conversationsWithCleanResponse);
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

    const conversation = result.rows[0];

    // Strip JSON from response for user display
    const cleanResponse = aiService.stripJSONFromResponse(conversation.response);

    // Get related maintenance requests
    const maintenanceResult = await db.query(
      "SELECT * FROM maintenance_requests WHERE conversation_id = $1",
      [id]
    );
    
    // Get attachments for this conversation
    const attachmentsResult = await db.query(
      "SELECT * FROM attachments WHERE conversation_id = $1 ORDER BY created_at ASC",
      [id]
    );
    
    res.json({
      ...conversation,
      response_display: cleanResponse,
      related_maintenance: maintenanceResult.rows,
      attachments: attachmentsResult.rows,
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
