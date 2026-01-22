const express = require("express");
const db = require("../config/database");
const authenticateToken = require("../middleware/auth");
const aiService = require("../services/aiService");
const router = express.Router();

// Get all conversation threads with pagination and search
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, tenant_id, page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (tenant_id) {
      conditions.push(`ct.tenant_id = $${paramIndex}`);
      params.push(parseInt(tenant_id));
      paramIndex++;
    }

    if (status) {
      conditions.push(`ct.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(t.name ILIKE $${paramIndex} OR ct.subject ILIKE $${paramIndex + 1})`);
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM conversation_threads ct
       LEFT JOIN tenants t ON ct.tenant_id = t.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

    // Get threads with message counts and last message preview
    const threadsResult = await db.query(
      `SELECT
         ct.*,
         t.name as tenant_name,
         t.email as tenant_email,
         p.address as property_address,
         msg_counts.message_count,
         last_msg.message as last_message,
         last_msg.timestamp as last_message_time
       FROM conversation_threads ct
       LEFT JOIN tenants t ON ct.tenant_id = t.id
       LEFT JOIN properties p ON ct.property_id = p.id
       LEFT JOIN (
         SELECT thread_id, COUNT(*) as message_count
         FROM messages
         GROUP BY thread_id
       ) msg_counts ON ct.id = msg_counts.thread_id
       LEFT JOIN (
         SELECT DISTINCT ON (thread_id) thread_id, message, timestamp
         FROM messages
         WHERE message_type = 'user_message'
         ORDER BY thread_id, timestamp DESC
       ) last_msg ON ct.id = last_msg.thread_id
       ${whereClause}
       ORDER BY ct.last_activity_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: threadsResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get conversation analytics (must be before /:id route)
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    // Get total conversations
    const totalResult = await db.query(
      "SELECT COUNT(*) as total FROM conversation_threads"
    );
    const total = parseInt(totalResult.rows[0].total);

    // Get conversations by channel
    const channelResult = await db.query(
      `SELECT
        channel,
        COUNT(*) as count
       FROM conversation_threads
       GROUP BY channel
       ORDER BY count DESC`
    );

    const channelStats = {
      sms: 0,
      email: 0,
      whatsapp: 0,
      other: 0
    };

    channelResult.rows.forEach(row => {
      if (channelStats.hasOwnProperty(row.channel)) {
        channelStats[row.channel] = parseInt(row.count);
      } else {
        channelStats.other += parseInt(row.count);
      }
    });

    // Get threads by status
    const statusResult = await db.query(
      `SELECT
        status,
        COUNT(*) as count
       FROM conversation_threads
       GROUP BY status
       ORDER BY count DESC`
    );

    const statusStats = {
      active: 0,
      resolved: 0,
      escalated: 0
    };

    statusResult.rows.forEach(row => {
      if (statusStats.hasOwnProperty(row.status)) {
        statusStats[row.status] = parseInt(row.count);
      }
    });

    res.json({
      total,
      by_channel: channelStats,
      by_status: statusStats
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Get single conversation thread with all messages
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get thread details
    const threadResult = await db.query(
      `SELECT
         ct.*,
         t.name as tenant_name,
         t.phone as tenant_phone,
         t.email as tenant_email,
         p.address as property_address
       FROM conversation_threads ct
       LEFT JOIN tenants t ON ct.tenant_id = t.id
       LEFT JOIN properties p ON ct.property_id = p.id
       WHERE ct.id = $1`,
      [id]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const thread = threadResult.rows[0];

    // Get all messages in this thread
    const messagesResult = await db.query(
      `SELECT m.*
       FROM messages m
       WHERE m.thread_id = $1
       ORDER BY m.timestamp ASC`,
      [id]
    );

    // Process messages to add display_text for AI responses
    const messages = messagesResult.rows.map(msg => ({
      ...msg,
      display_text: msg.message_type === 'ai_response'
        ? aiService.stripJSONFromResponse(msg.response)
        : msg.message
    }));

    // Get related maintenance requests
    const maintenanceResult = await db.query(
      `SELECT mr.*
       FROM maintenance_requests mr
       JOIN messages m ON mr.message_id = m.id
       WHERE m.thread_id = $1
       ORDER BY mr.created_at DESC`,
      [id]
    );

    // Get attachments
    const attachmentsResult = await db.query(
      `SELECT a.*
       FROM attachments a
       JOIN messages m ON a.message_id = m.id
       WHERE m.thread_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      ...thread,
      messages: messages,
      related_maintenance: maintenanceResult.rows,
      attachments: attachmentsResult.rows
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

    // Get original thread to get tenant info
    const convResult = await db.query(
      "SELECT ct.*, t.phone as tenant_phone, t.email as tenant_email, ct.channel FROM conversation_threads ct LEFT JOIN tenants t ON ct.tenant_id = t.id WHERE ct.id = $1",
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

// Toggle flag status of message
router.patch("/:id/flag", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { flagged } = req.body;

    if (flagged === undefined) {
      return res.status(400).json({ error: "Flagged status is required" });
    }

    const result = await db.query(
      `UPDATE messages
       SET flagged = $1
       WHERE id = $2
       RETURNING *`,
      [flagged, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Flag message error:", error);
    res.status(500).json({ error: "Failed to flag message" });
  }
});

// Get flagged conversations
router.get("/flagged/list", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        m.*,
        t.name as tenant_name,
        p.address as property_address
      FROM messages m
      LEFT JOIN tenants t ON m.tenant_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE m.flagged = true
      ORDER BY m.timestamp DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get flagged conversations error:", error);
    res.status(500).json({ error: "Failed to fetch flagged conversations" });
  }
});

// Update thread status
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'resolved', 'escalated'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      `UPDATE conversation_threads
       SET status = $1,
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update conversation status error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;
