const db = require('../config/database');
const aiService = require('./aiService');

/**
 * Conversation Service - Handles thread management operations
 */
class ConversationService {

  /**
   * Log conversation event for tracking lifecycle
   * @param {Number} threadId - Thread ID
   * @param {Number} tenantId - Tenant ID
   * @param {String} eventType - Event type
   * @param {Object} eventData - Event data
   * @returns {Object} Log result
   */
  async logConversationEvent(threadId, tenantId, eventType, eventData = {}) {
    try {
      await db.query(
        `INSERT INTO conversation_events
           (thread_id, tenant_id, event_type, event_data, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
        [threadId, tenantId, eventType, JSON.stringify(eventData)]
      );

      console.log(`[Conversation Event] Thread ${threadId}: ${eventType}`, eventData);
      return { success: true };
    } catch (error) {
      console.error('[Conversation Event] Error:', error);
      throw error;
    }
  }

  /**
   * Close inactive threads based on property settings
   * Runs automatically on schedule
   */
  async closeInactiveThreads() {
    try {
      console.log('[Auto-Closure] Starting inactive thread closure check');

      // Get properties with their inactivity settings
      const propertiesResult = await db.query(
        'SELECT id, thread_inactivity_hours FROM properties'
      );

      let totalClosed = 0;

      for (const property of propertiesResult.rows) {
        const inactivityThreshold = property.thread_inactivity_hours || 72;

        // Find active/closing threads that have been inactive
        const inactiveThreads = await db.query(
          `SELECT ct.*, t.name as tenant_name
           FROM conversation_threads ct
           JOIN tenants t ON ct.tenant_id = t.id
           WHERE ct.property_id = $1
           AND ct.status IN ('active', 'closing')
           AND ct.last_activity_at < NOW() - INTERVAL '${inactivityThreshold} hours'
           ORDER BY ct.last_activity_at ASC`,
          [property.id]
        );

        for (const thread of inactiveThreads.rows) {
          const hoursInactive = Math.floor(
            (Date.now() - new Date(thread.last_activity_at).getTime()) / (1000 * 60 * 60)
          );

          console.log(`[Auto-Closure] Thread ${thread.id} inactive for ${hoursInactive}h - marking as closed`);

          await db.query(
            `UPDATE conversation_threads
               SET status = 'closed',
                   closed_at = NOW(),
                   closure_confidence = 1.0,
                   closure_factors = $1
               WHERE id = $2`,
            [
              JSON.stringify({
                reason: 'inactivity',
                hours_inactive: hoursInactive,
                threshold: inactivityThreshold
              }),
              thread.id
            ]
          );

          // Log closure event
          await this.logConversationEvent(
            thread.id,
            thread.tenant_id,
            'auto_closed',
            {
              reason: 'inactivity',
              hours_inactive: hoursInactive,
              threshold: inactivityThreshold
            }
          );

          totalClosed++;
        }
      }

      console.log(`[Auto-Closure] Processed ${totalClosed} inactive threads`);
      return { success: true, totalClosed };
    } catch (error) {
      console.error('[Auto-Closure] Error:', error);
      throw error;
    }
  }
  /**
   * Merge two threads together
   * @param {Number} threadId1 - Target thread ID (will contain all messages)
   * @param {Number} threadId2 - Source thread ID (will be merged into thread1)
   * @returns {Object} Merge result
   */
  async mergeThreads(threadId1, threadId2) {
    try {
      console.log(`[Thread Merge] Merging thread ${threadId2} into thread ${threadId1}`);

      // Move all messages from thread2 to thread1
      await db.query(
        `UPDATE messages SET thread_id = $1 WHERE thread_id = $2`,
        [threadId1, threadId2]
      );

      // Update thread1 activity and merge tracking
      await db.query(
        `UPDATE conversation_threads
         SET merged_from = array_append(COALESCE(merged_from, ARRAY[]::INTEGER[]), $2),
             last_activity_at = GREATEST(
               last_activity_at,
               (SELECT MAX(timestamp) FROM messages WHERE thread_id = $2)
             )
         WHERE id = $1`,
        [threadId1, threadId2]
      );

      // Mark thread2 as merged
      await db.query(
        `UPDATE conversation_threads
         SET status = 'merged', merged_into = $1
         WHERE id = $2`,
        [threadId1, threadId2]
      );

      console.log(`[Thread Merge] Successfully merged thread ${threadId2} into ${threadId1}`);
      return {
        success: true,
        targetThreadId: threadId1,
        sourceThreadId: threadId2,
        message: 'Threads merged successfully'
      };
    } catch (error) {
      console.error('[Thread Merge] Error:', error);
      throw error;
    }
  }

  /**
   * Categorize thread by topic
   * @param {Number} threadId - Thread ID
   * @param {Array} messages - Messages in thread
   * @returns {Object} Categorization result
   */
  async categorizeThread(threadId, messages) {
    try {
      const threadResult = await db.query(
        'SELECT * FROM conversation_threads WHERE id = $1',
        [threadId]
      );

      if (threadResult.rows.length === 0) {
        throw new Error('Thread not found');
      }

      const thread = threadResult.rows[0];

      // Use AI to categorize
      const categorization = await aiService.categorizeThread(thread.subject, messages);

      // Update thread with categorization
      await db.query(
        `UPDATE conversation_threads
         SET topic_category = $1, subtopic = $2
         WHERE id = $3`,
        [categorization.category, categorization.subtopic, threadId]
      );

      console.log(`[Thread Categorization] Thread ${threadId}: ${categorization.category} - ${categorization.subtopic}`);
      return {
        success: true,
        threadId,
        category: categorization.category,
        subtopic: categorization.subtopic
      };
    } catch (error) {
      console.error('[Thread Categorization] Error:', error);
      throw error;
    }
  }

  /**
   * Detect and update thread escalation status
   * @param {Number} threadId - Thread ID
   * @param {Array} messages - Messages in thread
   * @returns {Object} Escalation result
   */
  async detectEscalation(threadId, messages) {
    try {
      const threadResult = await db.query(
        'SELECT * FROM conversation_threads WHERE id = $1',
        [threadId]
      );

      if (threadResult.rows.length === 0) {
        throw new Error('Thread not found');
      }

      // Use AI to detect escalation
      const escalation = await aiService.detectEscalation(messages);

      // Update thread with escalation data
      await db.query(
        `UPDATE conversation_threads
         SET is_escalating = $1,
             escalation_confidence = $2,
             escalation_reasoning = $3,
             status = CASE WHEN $1 = true THEN 'escalated' ELSE status END
         WHERE id = $4`,
        [escalation.isEscalating, escalation.confidence, escalation.reasoning, threadId]
      );

      if (escalation.isEscalating) {
        console.log(`[Escalation Detection] Thread ${threadId} is escalating: ${escalation.reasoning}`);
      }

      return {
        success: true,
        threadId,
        isEscalating: escalation.isEscalating,
        confidence: escalation.confidence,
        reasoning: escalation.reasoning
      };
    } catch (error) {
      console.error('[Escalation Detection] Error:', error);
      throw error;
    }
  }

  /**
   * Generate and save thread summary
   * @param {Number} threadId - Thread ID
   * @param {Array} messages - Messages in thread
   * @returns {Object} Summary result
   */
  async generateThreadSummary(threadId, messages) {
    try {
      const threadResult = await db.query(
        'SELECT * FROM conversation_threads WHERE id = $1',
        [threadId]
      );

      if (threadResult.rows.length === 0) {
        throw new Error('Thread not found');
      }

      const thread = threadResult.rows[0];

      // Use AI to generate summary
      const summary = await aiService.generateThreadSummary(messages, thread.subject);

      // Update thread with summary
      await db.query(
        `UPDATE conversation_threads
         SET summary = $1
         WHERE id = $2`,
        [summary, threadId]
      );

      console.log(`[Thread Summary] Generated for thread ${threadId}: ${summary}`);
      return {
        success: true,
        threadId,
        summary
      };
    } catch (error) {
      console.error('[Thread Summary] Error:', error);
      throw error;
    }
  }

  /**
   * Find related threads for a given thread
   * @param {Number} threadId - Thread ID
   * @param {Number} tenantId - Tenant ID
   * @returns {Array} Related threads
   */
  async findRelatedThreads(threadId, tenantId) {
    try {
      const threadResult = await db.query(
        'SELECT * FROM conversation_threads WHERE id = $1',
        [threadId]
      );

      if (threadResult.rows.length === 0) {
        throw new Error('Thread not found');
      }

      const thread = threadResult.rows[0];

      // Get all threads for tenant in last 90 days
      const allThreadsResult = await db.query(
        `SELECT * FROM conversation_threads
         WHERE tenant_id = $1
         AND id != $2
         AND created_at > NOW() - INTERVAL '90 days'
         ORDER BY created_at DESC`,
        [tenantId, threadId]
      );

      const allThreads = allThreadsResult.rows;
      const relatedThreads = [];

      // Use AI to find similar threads
      for (const otherThread of allThreads) {
        // Check if relationship already exists
        const existingRelResult = await db.query(
          `SELECT * FROM thread_relationships
           WHERE thread_id_1 = $1 AND thread_id_2 = $2
              OR thread_id_1 = $2 AND thread_id_2 = $1`,
          [threadId, otherThread.id]
        );

        if (existingRelResult.rows.length > 0) {
          // Relationship already exists, add to results
          relatedThreads.push({
            thread: otherThread,
            ...existingRelResult.rows[0]
          });
          continue;
        }

        // Analyze similarity
        const similarity = await aiService.analyzeThreadSimilarity(
          thread,
          otherThread
        );

        if (similarity.confidence >= 0.7) {
          // Create relationship
          await db.query(
            `INSERT INTO thread_relationships (thread_id_1, thread_id_2, relationship_type, confidence)
             VALUES ($1, $2, $3, $4)`,
            [threadId, otherThread.id, similarity.relationship_type, similarity.confidence]
          );

          relatedThreads.push({
            thread: otherThread,
            ...similarity
          });
        }
      }

      console.log(`[Thread Relationships] Found ${relatedThreads.length} related threads for thread ${threadId}`);
      return relatedThreads;
    } catch (error) {
      console.error('[Thread Relationships] Error:', error);
      throw error;
    }
  }

  /**
   * Get active threads for a tenant with escalation detection
   * @param {Number} tenantId - Tenant ID
   * @returns {Array} Active threads
   */
  async getActiveThreadsWithEscalation(tenantId) {
    try {
      const result = await db.query(
        `SELECT * FROM conversation_threads
         WHERE tenant_id = $1
         AND status = 'active'
         ORDER BY last_activity_at DESC`,
        [tenantId]
      );

      const threads = result.rows;

      // For each thread, check for escalation
      for (const thread of threads) {
        const messagesResult = await db.query(
          `SELECT * FROM messages
           WHERE thread_id = $1
           ORDER BY timestamp DESC
           LIMIT 5`,
          [thread.id]
        );

        const messages = messagesResult.rows;

        if (messages.length > 0) {
          const escalation = await aiService.detectEscalation(messages);

          // Update thread escalation status
          await db.query(
            `UPDATE conversation_threads
               SET is_escalating = $1,
                   escalation_confidence = $2,
                   escalation_reasoning = $3
               WHERE id = $4`,
            [escalation.isEscalating, escalation.confidence, escalation.reasoning, thread.id]
          );

          thread.is_escalating = escalation.isEscalating;
          thread.escalation_confidence = escalation.confidence;
          thread.escalation_reasoning = escalation.reasoning;
        }
      }

      return threads;
    } catch (error) {
      console.error('[Get Active Threads] Error:', error);
      throw error;
    }
  }
}

module.exports = new ConversationService();
