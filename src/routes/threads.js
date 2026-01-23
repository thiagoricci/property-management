const express = require("express");
const db = require("../config/database");
const conversationService = require("../services/conversationService");
const notificationService = require("../services/notificationService");

const router = express.Router();

/**
 * POST /api/threads/merge
 * Merge two threads together
 */
router.post("/merge", async (req, res) => {
  try {
    const { thread_id_1, thread_id_2 } = req.body;

    if (!thread_id_1 || !thread_id_2) {
      return res.status(400).json({
        error: "Missing required fields: thread_id_1 and thread_id_2 are required"
      });
    }

    // Verify both threads exist
    const thread1Result = await db.query(
      "SELECT * FROM conversation_threads WHERE id = $1",
      [thread_id_1]
    );

    const thread2Result = await db.query(
      "SELECT * FROM conversation_threads WHERE id = $1",
      [thread_id_2]
    );

    if (thread1Result.rows.length === 0 || thread2Result.rows.length === 0) {
      return res.status(404).json({ error: "One or both threads not found" });
    }

    // Merge threads
    const result = await conversationService.mergeThreads(thread_id_1, thread_id_2);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Merge threads error:", error);
    res.status(500).json({
      error: "Failed to merge threads",
      details: error.message
    });
  }
});

/**
 * POST /api/threads/:threadId/categorize
 * Categorize thread by topic
 */
router.post("/:threadId/categorize", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread messages
    const messagesResult = await db.query(
      `SELECT * FROM messages
       WHERE thread_id = $1
       ORDER BY timestamp ASC`,
      [threadId]
    );

    if (messagesResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Categorize thread
    const result = await conversationService.categorizeThread(threadId, messagesResult.rows);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Categorize thread error:", error);
    res.status(500).json({
      error: "Failed to categorize thread",
      details: error.message
    });
  }
});

/**
 * POST /api/threads/:threadId/summary
 * Generate thread summary
 */
router.post("/:threadId/summary", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread messages
    const messagesResult = await db.query(
      `SELECT * FROM messages
       WHERE thread_id = $1
       ORDER BY timestamp ASC`,
      [threadId]
    );

    if (messagesResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Generate summary
    const result = await conversationService.generateThreadSummary(threadId, messagesResult.rows);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Generate thread summary error:", error);
    res.status(500).json({
      error: "Failed to generate thread summary",
      details: error.message
    });
  }
});

/**
 * POST /api/threads/:threadId/detect-escalation
 * Detect if thread is escalating
 */
router.post("/:threadId/detect-escalation", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread messages
    const messagesResult = await db.query(
      `SELECT * FROM messages
       WHERE thread_id = $1
       ORDER BY timestamp DESC
       LIMIT 5`,
      [threadId]
    );

    if (messagesResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Detect escalation
    const result = await conversationService.detectEscalation(threadId, messagesResult.rows);

    // If escalating, notify manager
    if (result.isEscalating && result.confidence >= 0.7) {
      const threadResult = await db.query(
        "SELECT * FROM conversation_threads WHERE id = $1",
        [threadId]
      );

      if (threadResult.rows.length > 0) {
        const thread = threadResult.rows[0];
        
        // Get tenant and property info
        const tenantResult = await db.query(
          "SELECT * FROM tenants WHERE id = $1",
          [thread.tenant_id]
        );
        
        const propertyResult = await db.query(
          "SELECT * FROM properties WHERE id = $1",
          [thread.property_id]
        );

        if (tenantResult.rows.length > 0 && propertyResult.rows.length > 0) {
          const tenant = tenantResult.rows[0];
          const property = propertyResult.rows[0];

          // Load admin user profile for notification
          const adminUserResult = await db.query(
            "SELECT id, email, phone FROM users WHERE id = 1"
          );
          const adminUser = adminUserResult.rows[0];

          // Send escalation notification to manager
          await notificationService.notifyManagerOfEscalation(
            thread,
            tenant,
            property,
            result.reasoning,
            adminUser ? adminUser.phone : property.owner_phone,
            adminUser ? adminUser.email : property.owner_email
          );
        }
      }
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Detect escalation error:", error);
    res.status(500).json({
      error: "Failed to detect escalation",
      details: error.message
    });
  }
});

/**
 * GET /api/threads/:threadId/related
 * Find related threads
 */
router.get("/:threadId/related", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread info
    const threadResult = await db.query(
      "SELECT * FROM conversation_threads WHERE id = $1",
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const thread = threadResult.rows[0];

    // Find related threads
    const relatedThreads = await conversationService.findRelatedThreads(threadId, thread.tenant_id);

    res.json({
      success: true,
      thread,
      related_threads: relatedThreads
    });
  } catch (error) {
    console.error("Find related threads error:", error);
    res.status(500).json({
      error: "Failed to find related threads",
      details: error.message
    });
  }
});

/**
 * GET /api/threads/active-with-escalation/:tenantId
 * Get active threads with escalation detection
 */
router.get("/active-with-escalation/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get active threads with escalation detection
    const threads = await conversationService.getActiveThreadsWithEscalation(parseInt(tenantId));

    res.json({
      success: true,
      threads
    });
  } catch (error) {
    console.error("Get active threads error:", error);
    res.status(500).json({
      error: "Failed to get active threads",
      details: error.message
    });
  }
});

/**
 * POST /api/threads/:threadId/close
 * Manually close a thread
 */
router.post("/:threadId/close", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason, status = 'closed' } = req.body;

    // Verify thread exists
    const threadResult = await db.query(
      'SELECT * FROM conversation_threads WHERE id = $1',
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threadResult.rows[0];

    // Update thread status
    await db.query(
      `UPDATE conversation_threads
         SET status = $1,
             closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE NULL END,
             closure_confidence = 1.0,
             closure_factors = $2
         WHERE id = $3`,
      [
        status,
        JSON.stringify({
          reason: 'manual',
          manager_reason: reason,
          previous_status: thread.status
        }),
        threadId
      ]
    );

    // Log closure event
    await conversationService.logConversationEvent(
      threadId,
      thread.tenant_id,
      'manually_closed',
      { reason, status }
    );

    console.log(`[Thread Management] Thread ${threadId} manually closed by manager: ${reason}`);

    res.json({
      success: true,
      threadId,
      status,
      message: `Thread ${status} successfully`
    });
  } catch (error) {
    console.error('Close thread error:', error);
    res.status(500).json({
      error: 'Failed to close thread',
      details: error.message
    });
  }
});

/**
 * POST /api/threads/:threadId/reopen
 * Reopen a closed thread
 */
router.post("/:threadId/reopen", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason } = req.body;

    // Verify thread exists and is closed
    const threadResult = await db.query(
      'SELECT * FROM conversation_threads WHERE id = $1',
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threadResult.rows[0];

    if (thread.status === 'active') {
      return res.status(400).json({ error: 'Thread is already active' });
    }

    // Reopen thread
    await db.query(
      `UPDATE conversation_threads
         SET status = 'active',
             closed_at = NULL,
             closure_confidence = NULL,
             closure_factors = NULL,
             last_activity_at = NOW()
         WHERE id = $1`,
      [threadId]
    );

    // Log reopen event
    await conversationService.logConversationEvent(
      threadId,
      thread.tenant_id,
      'reopened',
      { reason, previous_status: thread.status }
    );

    console.log(`[Thread Management] Thread ${threadId} reopened by manager: ${reason}`);

    res.json({
      success: true,
      threadId,
      status: 'active',
      message: 'Thread reopened successfully'
    });
  } catch (error) {
    console.error('Reopen thread error:', error);
    res.status(500).json({
      error: 'Failed to reopen thread',
      details: error.message
    });
  }
});

module.exports = router;
