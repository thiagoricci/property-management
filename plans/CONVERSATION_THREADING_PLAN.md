# Conversation Threading Implementation Plan

## Problem Statement

Currently, the system treats each message/response pair as a separate "conversation" record. This leads to:

- Incorrect conversation counts (messages = conversations)
- No grouping of related messages by topic/subject
- Inability to track conversation lifecycle (active → resolved)
- Difficult to understand conversation flow in dashboard

## Desired Behavior

1. **Messages**: Individual SMS/email/WhatsApp exchanges (tenant message + AI response)
2. **Conversations (Threads)**: Group of messages related to a single subject/topic
3. **AI Responsibility**: Detect when conversation topic changes or when conversation is resolved
4. **Examples**:
   - 3-4 messages about "leaky faucet" = 1 conversation
   - 6-10 messages about "broken AC" = 1 conversation
   - Tenant switches from "leaky faucet" to "parking issue" = new conversation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Conversation Layer                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  conversation_threads (topics/subjects)          │   │
│  │  - id, tenant_id, subject, status,           │   │
│  │    channel, created_at, resolved_at            │   │
│  └──────────────┬─────────────────────────────────┘   │
│                 │                                      │
│                 │ 1 thread has many messages              │
│                 ▼                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  messages (individual exchanges)                 │   │
│  │  - id, thread_id, tenant_id, channel,       │   │
│  │    message, response, ai_actions, timestamp    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### 1. Rename `conversations` table to `messages`

This better reflects that each row is a single message/response exchange.

### 2. Create `conversation_threads` table

```sql
CREATE TABLE conversation_threads (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  summary TEXT
);

-- Indexes for performance
CREATE INDEX idx_threads_tenant_id ON conversation_threads(tenant_id);
CREATE INDEX idx_threads_status ON conversation_threads(status);
CREATE INDEX idx_threads_last_activity ON conversation_threads(last_activity_at DESC);
CREATE INDEX idx_threads_tenant_status ON conversation_threads(tenant_id, status);
```

### 3. Update `messages` table (formerly `conversations`)

```sql
-- Rename conversations table to messages
ALTER TABLE conversations RENAME TO messages;

-- Add thread_id column to link messages to threads
ALTER TABLE messages ADD COLUMN thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE;

-- Add message_type column (user_message, ai_response)
ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'user_message'
  CHECK (message_type IN ('user_message', 'ai_response'));

-- Update foreign key references
-- maintenance_requests.conversation_id → maintenance_requests.message_id
ALTER TABLE maintenance_requests RENAME COLUMN conversation_id TO message_id;
ALTER TABLE maintenance_requests DROP CONSTRAINT maintenance_requests_conversation_id_fkey;
ALTER TABLE maintenance_requests ADD CONSTRAINT maintenance_requests_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- attachments.conversation_id → attachments.message_id
ALTER TABLE attachments RENAME COLUMN conversation_id TO message_id;
```

### 4. Add indexes to messages table

```sql
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_thread_timestamp ON messages(thread_id, timestamp ASC);
```

## AI Service Enhancements

### 1. Detect Conversation Topic Change

Add method to analyze if new message continues current topic or starts new one:

```javascript
/**
 * Analyze if message continues current conversation or starts new topic
 * @param {String} newMessage - New tenant message
 * @param {Object} currentThread - Current active thread (if any)
 * @param {Array} recentMessages - Recent messages in current thread
 * @returns {Object} { shouldContinue: boolean, newSubject: string|null, confidence: number }
 */
async detectTopicChange(newMessage, currentThread, recentMessages) {
  if (!currentThread) {
    // No active thread, create new one
    const subject = await this.extractSubject(newMessage);
    return { shouldContinue: false, newSubject: subject, confidence: 1.0 };
  }

  // Check time gap (if > 24 hours, likely new topic)
  const lastMessageTime = new Date(currentThread.last_activity_at);
  const timeSinceLastMessage = Date.now() - lastMessageTime.getTime();
  const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);

  if (hoursSinceLastMessage > 24) {
    const subject = await this.extractSubject(newMessage);
    return { shouldContinue: false, newSubject: subject, confidence: 0.9 };
  }

  // Use AI to analyze topic similarity
  const analysis = await this.analyzeTopicSimilarity(
    newMessage,
    currentThread.subject,
    recentMessages
  );

  return analysis;
}

/**
 * Use AI to analyze if message continues current topic
 * @param {String} newMessage - New tenant message
 * @param {String} currentSubject - Current thread subject
 * @param {Array} recentMessages - Recent messages in thread
 * @returns {Object} { shouldContinue: boolean, confidence: number }
 */
async analyzeTopicSimilarity(newMessage, currentSubject, recentMessages) {
  const recentContext = recentMessages
    .slice(-3)
    .map(m => `${m.message_type}: ${m.message}`)
    .join('\n');

  const prompt = `You are analyzing conversation flow.

Current conversation subject: "${currentSubject}"

Recent messages:
${recentContext}

New tenant message: "${newMessage}"

Analyze if this new message continues the same topic or starts a new subject.

Return JSON:
{
  "should_continue": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "new_subject": "new subject if should_continue is false, else null"
}

Guidelines:
- If message asks clarifying questions about current issue → continue
- If message provides more details about current issue → continue
- If message confirms resolution → continue
- If message mentions completely different issue → new subject
- If message is unrelated greeting/small talk → continue (treat as same thread)
- Confidence < 0.6 → create new thread
- Confidence >= 0.6 → continue current thread`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Topic analysis error:", error);
    // On error, continue current thread (safer default)
    return { should_continue: true, confidence: 0.5, reasoning: "Analysis failed" };
  }
}

/**
 * Extract subject/topic from message
 * @param {String} message - Tenant message
 * @returns {String} Subject line
 */
async extractSubject(message) {
  const prompt = `Extract a brief subject line (max 10 words) from this tenant message:

"${message}"

Return only the subject line, nothing else. Examples:
- "My sink is leaking" → "Leaky sink"
- "AC not working" → "AC not working"
- "Question about rent" → "Rent inquiry"
- "Parking spot issue" → "Parking issue"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.3,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Subject extraction error:", error);
    // Fallback: use first 50 characters
    return message.substring(0, 50) + (message.length > 50 ? "..." : "");
  }
}

/**
 * Detect if conversation is resolved
 * @param {String} lastResponse - Last AI response
 * @param {String} newMessage - New tenant message (if any)
 * @param {Array} messages - All messages in thread
 * @returns {Object} { isResolved: boolean, confidence: number }
 */
async detectConversationResolution(lastResponse, newMessage, messages) {
  // If tenant sends "thanks", "ok", "got it", etc. after resolution
  if (newMessage) {
    const closingPhrases = [
      'thanks', 'thank you', 'ok', 'got it', 'understood',
      'appreciate it', 'perfect', 'great', 'sounds good'
    ];
    const lowerMessage = newMessage.toLowerCase();
    if (closingPhrases.some(phrase => lowerMessage.includes(phrase))) {
      return { isResolved: true, confidence: 0.9 };
    }
  }

  // Use AI to analyze if conversation is resolved
  const recentMessages = messages.slice(-5)
    .map(m => `${m.message_type}: ${m.message}`)
    .join('\n');

  const prompt = `Analyze if this conversation is resolved:

${recentMessages}

Return JSON:
{
  "is_resolved": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Consider resolved if:
- Tenant's issue was addressed
- AI provided solution or next steps
- Tenant confirmed understanding
- No follow-up questions pending`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Resolution detection error:", error);
    return { isResolved: false, confidence: 0.0 };
  }
}
```

### 2. Update generateResponse to return thread analysis

```javascript
async generateResponseWithAnalysis(propertyInfo, tenantInfo, conversationHistory, newMessage, openMaintenanceRequests, currentThread) {
  // Generate AI response
  const response = await this.generateResponse(
    propertyInfo,
    tenantInfo,
    conversationHistory,
    newMessage,
    openMaintenanceRequests
  );

  // Analyze topic change
  const topicAnalysis = await this.detectTopicChange(
    newMessage,
    currentThread,
    conversationHistory
  );

  // Detect resolution
  const resolutionAnalysis = await this.detectConversationResolution(
    response,
    null, // No new message yet
    conversationHistory
  );

  return {
    response,
    topicAnalysis,
    resolutionAnalysis
  };
}
```

## Webhook Handler Updates

### 1. SMS Webhook (webhooks.js)

```javascript
router.post("/twilio/sms", async (req, res) => {
  try {
    const { From, To, Body, MessageSid } = req.body;

    // ... (tenant lookup code remains the same) ...

    const tenant = tenantResult.rows[0];

    // Load property information
    const property = propertyResult.rows[0] || null;

    // Find active thread for this tenant (SMS channel)
    const activeThreadResult = await db.query(
      `SELECT * FROM conversation_threads
       WHERE tenant_id = $1
       AND channel = 'sms'
       AND status = 'active'
       ORDER BY last_activity_at DESC
       LIMIT 1`,
      [tenant.id],
    );

    const activeThread = activeThreadResult.rows[0] || null;

    // Load recent messages from active thread (for topic analysis)
    let recentMessages = [];
    if (activeThread) {
      const messagesResult = await db.query(
        `SELECT * FROM messages
         WHERE thread_id = $1
         ORDER BY timestamp ASC
         LIMIT 10`,
        [activeThread.id],
      );
      recentMessages = messagesResult.rows;
    }

    // Format conversation history for AI
    const conversationHistory =
      aiService.formatConversationHistory(recentMessages);

    // Load open maintenance requests
    const maintenanceResult = await db.query(
      `SELECT issue_description, priority, status
       FROM maintenance_requests
       WHERE tenant_id = $1
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenant.id],
    );

    // Generate AI response with thread analysis
    const analysis = await aiService.generateResponseWithAnalysis(
      property,
      tenant,
      conversationHistory,
      Body,
      maintenanceResult.rows,
      activeThread,
    );

    const { response, topicAnalysis, resolutionAnalysis } = analysis;

    // Determine if we should continue current thread or create new one
    let threadId;
    let isNewThread = false;

    if (activeThread && topicAnalysis.shouldContinue) {
      // Continue existing thread
      threadId = activeThread.id;

      // Update thread activity
      await db.query(
        `UPDATE conversation_threads
         SET last_activity_at = NOW()
         WHERE id = $1`,
        [threadId],
      );

      // Check if conversation is resolved
      if (
        resolutionAnalysis.isResolved &&
        resolutionAnalysis.confidence >= 0.8
      ) {
        await db.query(
          `UPDATE conversation_threads
           SET status = 'resolved', resolved_at = NOW()
           WHERE id = $1`,
          [threadId],
        );
      }
    } else {
      // Create new thread
      const subject =
        topicAnalysis.newSubject || (await aiService.extractSubject(Body));

      const threadResult = await db.query(
        `INSERT INTO conversation_threads
         (tenant_id, property_id, subject, channel, created_at, last_activity_at)
         VALUES ($1, $2, $3, 'sms', NOW(), NOW())
         RETURNING *`,
        [tenant.id, property ? property.id : null, subject],
      );

      threadId = threadResult.rows[0].id;
      isNewThread = true;
    }

    // Extract actions from AI response
    const actions = aiService.extractActions(response);
    const deduplicatedActions = aiService.deduplicateActions(actions);

    // Log tenant message
    const messageResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, message_type, timestamp)
       VALUES ($1, $2, 'sms', $3, 'user_message', NOW())
       RETURNING *`,
      [threadId, tenant.id, Body],
    );

    const savedMessage = messageResult.rows[0];

    // Log AI response
    const responseResult = await db.query(
      `INSERT INTO messages
       (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
       VALUES ($1, $2, 'sms', $3, $4, $5, 'ai_response', NOW())
       RETURNING *`,
      [
        threadId,
        tenant.id,
        Body, // Store original message for reference
        response,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ],
    );

    const savedResponse = responseResult.rows[0];

    // Execute actions
    const executedActions = [];
    for (const action of deduplicatedActions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          savedResponse.id, // Use message_id instead of conversation_id
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({
          ...action,
          status: "failed",
          error: error.message,
        });
      }
    }

    // Send AI response via SMS
    const cleanResponse = cleanupResponseForSMS(response);

    try {
      await twilio.sendSMS(From, cleanResponse);
      console.log(`Sent SMS response to ${From}`);
    } catch (error) {
      console.error("Failed to send SMS response:", error);
    }

    // Return TwiML response
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${cleanResponse}</Message>
      </Response>`,
    );
  } catch (error) {
    console.error("Twilio webhook error:", error);
    res
      .status(500)
      .type("text/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>I apologize, but I'm having trouble processing your request right now.</Message>
      </Response>`,
      );
  }
});
```

### 2. Email Webhook

Similar updates to SMS webhook, using email channel.

## API Endpoint Updates

### 1. GET /api/conversations (now returns threads)

```javascript
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, tenant_id, page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

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
      conditions.push(
        `(t.name ILIKE $${paramIndex} OR ct.subject ILIKE $${paramIndex + 1})`,
      );
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM conversation_threads ct
       LEFT JOIN tenants t ON ct.tenant_id = t.id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

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
      [...params, parseInt(limit), offset],
    );

    res.json({
      data: threadsResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasMore: parseInt(page) < totalPages,
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});
```

### 2. GET /api/conversations/:id (thread detail with all messages)

```javascript
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
      [id],
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const thread = threadResult.rows[0];

    // Get all messages in this thread
    const messagesResult = await db.query(
      `SELECT
         m.*,
         CASE WHEN m.message_type = 'ai_response'
           THEN aiService.stripJSONFromResponse(m.response)
           ELSE m.message
         END as display_text
       FROM messages m
       WHERE m.thread_id = $1
       ORDER BY m.timestamp ASC`,
      [id],
    );

    // Get related maintenance requests
    const maintenanceResult = await db.query(
      `SELECT mr.*
       FROM maintenance_requests mr
       JOIN messages m ON mr.message_id = m.id
       WHERE m.thread_id = $1
       ORDER BY mr.created_at DESC`,
      [id],
    );

    // Get attachments
    const attachmentsResult = await db.query(
      `SELECT a.*
       FROM attachments a
       JOIN messages m ON a.message_id = m.id
       WHERE m.thread_id = $1
       ORDER BY a.created_at ASC`,
      [id],
    );

    res.json({
      thread,
      messages: messagesResult.rows,
      related_maintenance: maintenanceResult.rows,
      attachments: attachmentsResult.rows,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});
```

### 3. PATCH /api/conversations/:id/status

```javascript
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "resolved", "escalated"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      `UPDATE conversation_threads
       SET status = $1,
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $2
       RETURNING *`,
      [status, id],
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
```

## Frontend Updates

### 1. Update TypeScript types

```typescript
// types/index.ts

export interface Message {
  id: number;
  thread_id: number;
  tenant_id: number;
  channel: "sms" | "email" | "whatsapp";
  message: string;
  response?: string;
  ai_actions?: any;
  message_type: "user_message" | "ai_response";
  timestamp: string;
  display_text?: string;
}

export interface ConversationThread {
  id: number;
  tenant_id: number;
  property_id: number;
  subject: string;
  status: "active" | "resolved" | "escalated";
  channel: "sms" | "email" | "whatsapp";
  created_at: string;
  resolved_at?: string;
  last_activity_at: string;
  summary?: string;
  tenant_name?: string;
  tenant_email?: string;
  property_address?: string;
  message_count?: number;
  last_message?: string;
  last_message_time?: string;
}
```

### 2. Update conversations list page

- Display threads instead of individual messages
- Show thread status (active/resolved)
- Show message count per thread
- Show subject line
- Click to view all messages in thread

### 3. Update conversation detail page

- Display all messages in thread chronologically
- Chat-style interface with user/AI messages
- Show thread status and allow manual status change
- Show related maintenance requests
- Show attachments

## Migration Script

Create `database/migrations/006_add_conversation_threading.sql`:

```sql
-- Migration 006: Add Conversation Threading Support
-- This migration adds proper conversation threading to separate topics from individual messages

BEGIN;

-- 1. Create conversation_threads table
CREATE TABLE conversation_threads (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  summary TEXT
);

-- 2. Rename conversations table to messages
ALTER TABLE conversations RENAME TO messages;

-- 3. Add thread_id column to messages
ALTER TABLE messages ADD COLUMN thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE;

-- 4. Add message_type column to messages
ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'user_message'
  CHECK (message_type IN ('user_message', 'ai_response'));

-- 5. Update all existing records to have message_type
UPDATE messages SET message_type = 'user_message' WHERE message_type IS NULL;

-- 6. Create threads for existing messages (one thread per original conversation)
INSERT INTO conversation_threads (tenant_id, property_id, subject, channel, created_at, last_activity_at)
SELECT
  m.tenant_id,
  t.property_id,
  COALESCE(m.subject, LEFT(m.message, 100)) as subject,
  m.channel,
  m.timestamp,
  m.timestamp
FROM messages m
LEFT JOIN tenants t ON m.tenant_id = t.id
WHERE m.thread_id IS NULL;

-- 7. Link existing messages to their new threads
UPDATE messages m
SET thread_id = ct.id
FROM conversation_threads ct
WHERE ct.tenant_id = m.tenant_id
  AND ct.channel = m.channel
  AND ct.created_at = m.timestamp
  AND m.thread_id IS NULL;

-- 8. Update maintenance_requests foreign key
ALTER TABLE maintenance_requests RENAME COLUMN conversation_id TO message_id;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_conversation_id_fkey;
ALTER TABLE maintenance_requests ADD CONSTRAINT maintenance_requests_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- 9. Update attachments foreign key
ALTER TABLE attachments RENAME COLUMN conversation_id TO message_id;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_conversation_id_fkey;
ALTER TABLE attachments ADD CONSTRAINT attachments_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- 10. Create indexes for performance
CREATE INDEX idx_threads_tenant_id ON conversation_threads(tenant_id);
CREATE INDEX idx_threads_status ON conversation_threads(status);
CREATE INDEX idx_threads_last_activity ON conversation_threads(last_activity_at DESC);
CREATE INDEX idx_threads_tenant_status ON conversation_threads(tenant_id, status);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_thread_timestamp ON messages(thread_id, timestamp ASC);

COMMIT;

-- Verify migration
SELECT 'Migration 006 completed successfully' as status;
```

## Testing Scenarios

### Scenario 1: Single Topic Conversation

1. Tenant: "My sink is leaking"
2. AI: Creates thread with subject "Leaky sink"
3. Tenant: "It's dripping constantly"
4. AI: Continues same thread
5. Tenant: "Thanks for your help"
6. AI: Detects resolution, marks thread as resolved

**Expected**: 1 thread, 3 messages

### Scenario 2: Topic Change

1. Tenant: "My sink is leaking"
2. AI: Creates thread with subject "Leaky sink"
3. Tenant: "Actually, I also have a question about parking"
4. AI: Detects topic change, creates new thread "Parking question"

**Expected**: 2 threads, 2 messages

### Scenario 3: Time Gap

1. Tenant: "My AC is broken" (Monday)
2. AI: Creates thread "AC not working"
3. Tenant: "Still waiting for repair" (Tuesday)
4. AI: Continues same thread
5. Tenant: "My sink is leaking" (Friday, 3 days later)
6. AI: Detects new topic due to time gap, creates new thread

**Expected**: 2 threads, 3 messages

### Scenario 4: Multiple Issues in Same Conversation

1. Tenant: "My sink is leaking and my AC is also broken"
2. AI: Creates thread "Leaky sink and AC issue"
3. Tenant: "Can you help with both?"
4. AI: Continues same thread (related issues)
5. Tenant: "Thanks for handling both"
6. AI: Resolves thread

**Expected**: 1 thread, 3 messages

## Benefits

1. **Accurate Conversation Counting**: Threads = conversations, messages = exchanges
2. **Better Context**: AI can see full topic history
3. **Improved Analytics**: Track resolution rates, conversation length
4. **Enhanced Dashboard**: Clearer view of conversation flow
5. **Flexible Management**: Managers can manually resolve/escalate threads

## Rollback Plan

If issues arise, can rollback by:

1. Restore from database backup
2. Or reverse migration manually (rename messages back to conversations, drop conversation_threads, etc.)

## Next Steps

1. Review and approve this plan
2. Create migration script
3. Update AI service with topic detection
4. Update webhook handlers
5. Update API endpoints
6. Update frontend components
7. Test with various scenarios
8. Deploy to staging
9. Monitor and iterate
