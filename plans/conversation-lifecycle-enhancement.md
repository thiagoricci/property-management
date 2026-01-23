# Conversation Lifecycle Enhancement Plan

## Executive Summary

Enhance the AI Property Manager's conversation threading system to provide clearer detection and management of conversation starts, active states, and closures. This will improve the tenant experience by ensuring conversations are properly grouped and property managers have clear visibility into conversation states.

## Current State Analysis

### ✅ What's Already Working

1. **Conversation Threading Structure**
   - `conversation_threads` table with status field ('active', 'resolved', 'escalated')
   - `messages` table with thread_id foreign key
   - Proper indexes for performance

2. **Thread Detection Logic** (aiService.js)
   - `detectTopicChange()` - AI analyzes if new message continues existing thread
   - Time-based threshold (configurable, default 48 hours)
   - Creates new thread when topic changes or time gap exceeded

3. **Resolution Detection** (aiService.js)
   - `detectConversationResolution()` - Checks if conversation is resolved
   - Closing phrases detection (thanks, ok, got it, etc.)
   - AI analysis for complex cases
   - Updates thread status to 'resolved' when confidence >= 0.8

4. **Thread Management** (messages.js, webhooks.js)
   - Finds active threads for tenant/channel
   - Creates new threads when needed
   - Updates thread activity (last_activity_at)
   - Marks threads as resolved

### ❌ What's Missing

1. **Clear Conversation Start Indicators**
   - No explicit "conversation started" event/logging
   - No clear visual indicator in dashboard
   - No notification to manager when new conversation starts

2. **Enhanced End/Closure Detection**
   - Single-factor detection (closing phrases + AI)
   - No inactivity-based closure
   - No multi-factor confidence scoring
   - No "closing" intermediate status

3. **Conversation Lifecycle States**
   - Only 3 states: active, resolved, escalated
   - Missing: "closing", "inactive", "awaiting_response"
   - No clear state transitions

4. **Automatic Thread Closure**
   - No inactivity-based automatic closure
   - No configurable timeout periods
   - No grace period before closure

5. **Manager Controls**
   - No manual thread closure capability
   - No thread re-opening mechanism
   - No conversation state overrides

## Enhancement Plan

### Phase 1: Enhanced Start Detection

#### 1.1 AI-Powered Conversation Start Analysis

**Objective**: Improve detection of when a new conversation begins

**Implementation**:

```javascript
// Add to aiService.js
async detectConversationStart(newMessage, tenantId, channelId, lastThread) {
  // Check if this is a new conversation start
  const analysis = await this.analyzeConversationStart(
    newMessage,
    lastThread,
    tenantId
  );

  return {
    isNewConversation: analysis.is_new_conversation,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
    suggestedSubject: analysis.suggested_subject
  };
}

async analyzeConversationStart(newMessage, lastThread, tenantId) {
  const lastActivity = lastThread ? new Date(lastThread.last_activity_at) : null;
  const hoursSinceLastActivity = lastActivity
    ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
    : Infinity;

  const prompt = `Analyze if this message starts a NEW conversation or continues an EXISTING one.

Last thread activity: ${hoursSinceLastActivity.toFixed(1)} hours ago
Last thread subject: "${lastThread?.subject || 'None'}"
Last thread status: "${lastThread?.status || 'None'}"

New tenant message: "${newMessage}"

Return JSON:
{
  "is_new_conversation": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggested_subject": "subject if new conversation, else null"
}

NEW CONVERSATION indicators:
- First message ever from tenant
- More than 24 hours since last message
- Completely different topic from previous conversation
- Greeting or new inquiry ("Hi", "Hello", "Question about...")
- Explicitly starts new topic ("I have another question", "Actually, about...")

CONTINUE EXISTING indicators:
- Follow-up to previous discussion
- Clarification question
- Related to same topic
- Acknowledgment or confirmation
- "Thanks", "OK", "Got it" responses

Confidence thresholds:
- Confidence >= 0.7 → new conversation
- Confidence < 0.7 → continue existing`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 300,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Benefits**:

- More accurate detection of conversation starts
- Better subject suggestions for new threads
- Clear reasoning for thread creation decisions

#### 1.2 Conversation Start Event Logging

**Objective**: Track and log when conversations start

**Implementation**:

```javascript
// Add to messages.js and webhooks.js
async function logConversationStart(
  threadId,
  tenantId,
  channel,
  message,
  analysis,
) {
  await db.query(
    `INSERT INTO conversation_events
       (thread_id, tenant_id, event_type, event_data, created_at)
       VALUES ($1, $2, 'conversation_started', $3, NOW())`,
    [
      threadId,
      tenantId,
      JSON.stringify({
        channel,
        message_preview: message.substring(0, 100),
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      }),
    ],
  );

  console.log(
    `[Conversation Start] Thread ${threadId} started by tenant ${tenantId} via ${channel}`,
  );
}
```

**Database Migration**:

```sql
-- Add conversation_events table
CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_thread_id ON conversation_events(thread_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON conversation_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON conversation_events(created_at DESC);
```

### Phase 2: Enhanced End/Closure Detection

#### 2.1 Multi-Factor Closure Detection

**Objective**: Improve accuracy of conversation end detection using multiple factors

**Implementation**:

```javascript
// Add to aiService.js
async detectConversationClosure(lastResponse, newMessage, messages, thread) {
  // Factor 1: Closing phrases in tenant message
  const closingScore = this.detectClosingPhrases(newMessage);

  // Factor 2: AI analysis of conversation state
  const aiAnalysis = await this.analyzeConversationState(messages, lastResponse);

  // Factor 3: Inactivity period
  const inactivityScore = this.calculateInactivityScore(thread);

  // Factor 4: Resolution indicators in AI response
  const resolutionScore = this.detectResolutionIndicators(lastResponse);

  // Combine scores with weights
  const totalScore = (
    closingScore * 0.3 +
    aiAnalysis.confidence * 0.4 +
    inactivityScore * 0.2 +
    resolutionScore * 0.1
  );

  return {
    shouldClose: totalScore >= 0.7,
    confidence: totalScore,
    factors: {
      closing: closingScore,
      aiAnalysis: aiAnalysis.confidence,
      inactivity: inactivityScore,
      resolution: resolutionScore
    },
    reasoning: aiAnalysis.reasoning,
    suggestedStatus: totalScore >= 0.9 ? 'closed' : 'closing'
  };
}

detectClosingPhrases(message) {
  if (!message) return 0;

  const strongClosings = [
    'thank you', 'thanks again', 'appreciate your help',
    'problem solved', 'all set', 'that works perfectly',
    'goodbye', 'talk to you later'
  ];

  const moderateClosings = [
    'thanks', 'ok', 'got it', 'understood',
    'perfect', 'great', 'sounds good',
    'that helps', 'good to know'
  ];

  const lowerMessage = message.toLowerCase();

  if (strongClosings.some(phrase => lowerMessage.includes(phrase))) {
    return 0.9;
  }

  if (moderateClosings.some(phrase => lowerMessage.includes(phrase))) {
    return 0.6;
  }

  return 0;
}

detectResolutionIndicators(response) {
  if (!response) return 0;

  const resolutionPhrases = [
    'issue resolved', 'problem fixed', 'solution provided',
    'ticket created', 'maintenance scheduled',
    'request submitted', 'escalated to manager'
  ];

  const lowerResponse = response.toLowerCase();
  const matches = resolutionPhrases.filter(phrase => lowerResponse.includes(phrase));

  return Math.min(matches.length * 0.3, 1.0);
}

calculateInactivityScore(thread) {
  if (!thread) return 0;

  const lastActivity = new Date(thread.last_activity_at);
  const hoursInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

  // 24+ hours = 0.8, 48+ hours = 1.0
  return Math.min(hoursInactive / 48, 1.0);
}

async analyzeConversationState(messages, lastResponse) {
  const recentMessages = messages.slice(-5)
    .map(m => `${m.message_type}: ${m.message || m.response}`)
    .join('\n');

  const prompt = `Analyze if this conversation has reached a natural conclusion.

${recentMessages}

Return JSON:
{
  "is_concluded": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

CONCLUDED indicators:
- Tenant's issue was addressed or resolved
- AI provided solution or next steps
- Tenant confirmed understanding or satisfaction
- No pending questions or follow-ups
- Maintenance request was created/updated
- Action items were completed

ONGOING indicators:
- Tenant has unanswered questions
- AI asked for clarification
- Issue still unresolved
- Tenant expressed dissatisfaction
- Follow-up needed
- Multiple exchanges about same problem`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

#### 2.2 Intermediate "Closing" Status

**Objective**: Add intermediate state before final closure

**Database Migration**:

```sql
-- Add 'closing' status to conversation_threads
ALTER TABLE conversation_threads
DROP CONSTRAINT IF EXISTS conversation_threads_status_check;

ALTER TABLE conversation_threads
ADD CONSTRAINT conversation_threads_status_check
CHECK (status IN ('active', 'closing', 'resolved', 'escalated', 'closed'));
```

**Implementation**:

```javascript
// In messages.js and webhooks.js
if (closureAnalysis.shouldClose) {
  if (closureAnalysis.suggestedStatus === "closing") {
    // Mark as closing first
    await db.query(
      `UPDATE conversation_threads
         SET status = 'closing',
             closure_confidence = $1,
             closure_factors = $2
         WHERE id = $3`,
      [
        closureAnalysis.confidence,
        JSON.stringify(closureAnalysis.factors),
        threadId,
      ],
    );
    console.log(
      `[Thread Management] Thread ${threadId} marked as closing (confidence: ${closureAnalysis.confidence})`,
    );
  } else if (closureAnalysis.confidence >= 0.9) {
    // High confidence - close immediately
    await db.query(
      `UPDATE conversation_threads
         SET status = 'closed',
             closed_at = NOW(),
             closure_confidence = $1,
             closure_factors = $2
         WHERE id = $3`,
      [
        closureAnalysis.confidence,
        JSON.stringify(closureAnalysis.factors),
        threadId,
      ],
    );
    console.log(
      `[Thread Management] Thread ${threadId} closed (confidence: ${closureAnalysis.confidence})`,
    );
  }
}
```

### Phase 3: Inactivity-Based Automatic Closure

#### 3.1 Configurable Inactivity Thresholds

**Database Migration**:

```sql
-- Add inactivity settings to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS thread_inactivity_hours INTEGER DEFAULT 72;

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS thread_closure_grace_hours INTEGER DEFAULT 24;

-- Add columns to conversation_threads
ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closure_confidence DECIMAL(3,2);

ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closure_factors JSONB;

ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
```

**Implementation**:

```javascript
// Add to conversationService.js
async closeInactiveThreads() {
  try {
    // Get properties with their inactivity settings
    const propertiesResult = await db.query(
      'SELECT id, thread_inactivity_hours FROM properties'
    );

    for (const property of propertiesResult.rows) {
      const inactivityThreshold = property.thread_inactivity_hours || 72;

      // Find active threads that have been inactive
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
            hours_inactive: hoursInactive
          }
        );
      }
    }

    console.log(`[Auto-Closure] Processed ${inactiveThreads.rows.length} inactive threads`);
  } catch (error) {
    console.error('[Auto-Closure] Error:', error);
  }
}

async logConversationEvent(threadId, tenantId, eventType, eventData) {
  await db.query(
    `INSERT INTO conversation_events
       (thread_id, tenant_id, event_type, event_data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
    [threadId, tenantId, eventType, JSON.stringify(eventData)]
  );
}
```

**Scheduled Task**:

```javascript
// Add to server.js
const cron = require("node-cron");

// Run auto-closure check every hour
cron.schedule("0 * * * *", async () => {
  console.log("[Scheduled Task] Running inactive thread closure check");
  await conversationService.closeInactiveThreads();
});
```

### Phase 4: Manager Controls

#### 4.1 Manual Thread Closure

**API Endpoint**:

```javascript
// Add to threads.js
router.post("/:threadId/close", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason, status = "closed" } = req.body;

    // Verify thread exists
    const threadResult = await db.query(
      "SELECT * FROM conversation_threads WHERE id = $1",
      [threadId],
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
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
          reason: "manual",
          manager_reason: reason,
          previous_status: thread.status,
        }),
        threadId,
      ],
    );

    // Log closure event
    await conversationService.logConversationEvent(
      threadId,
      thread.tenant_id,
      "manually_closed",
      { reason, status },
    );

    console.log(
      `[Thread Management] Thread ${threadId} manually closed by manager: ${reason}`,
    );

    res.json({
      success: true,
      threadId,
      status,
      message: `Thread ${status} successfully`,
    });
  } catch (error) {
    console.error("Close thread error:", error);
    res.status(500).json({
      error: "Failed to close thread",
      details: error.message,
    });
  }
});
```

#### 4.2 Thread Reopening

```javascript
router.post("/:threadId/reopen", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason } = req.body;

    // Verify thread exists and is closed
    const threadResult = await db.query(
      "SELECT * FROM conversation_threads WHERE id = $1",
      [threadId],
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const thread = threadResult.rows[0];

    if (thread.status === "active") {
      return res.status(400).json({ error: "Thread is already active" });
    }

    // Reopen thread
    await db.query(
      `UPDATE conversation_threads
         SET status = 'active',
             closed_at = NULL,
             last_activity_at = NOW()
         WHERE id = $1`,
      [threadId],
    );

    // Log reopen event
    await conversationService.logConversationEvent(
      threadId,
      thread.tenant_id,
      "reopened",
      { reason, previous_status: thread.status },
    );

    console.log(
      `[Thread Management] Thread ${threadId} reopened by manager: ${reason}`,
    );

    res.json({
      success: true,
      threadId,
      status: "active",
      message: "Thread reopened successfully",
    });
  } catch (error) {
    console.error("Reopen thread error:", error);
    res.status(500).json({
      error: "Failed to reopen thread",
      details: error.message,
    });
  }
});
```

### Phase 5: Dashboard Enhancements

#### 5.1 Conversation Lifecycle Display

**TypeScript Types**:

```typescript
// Add to dashboard/src/types/index.ts
export type ConversationStatus =
  | "active"
  | "closing"
  | "resolved"
  | "escalated"
  | "closed";

export interface ConversationThread {
  id: number;
  tenant_id: number;
  property_id: number;
  subject: string;
  status: ConversationStatus;
  channel: "sms" | "email" | "whatsapp";
  created_at: string;
  last_activity_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  closure_confidence: number | null;
  closure_factors: any | null;
  summary: string | null;
}
```

**Status Badge Component**:

```typescript
// dashboard/src/components/ThreadStatusBadge.tsx
interface ThreadStatusBadgeProps {
  status: ConversationStatus;
}

export function ThreadStatusBadge({ status }: ThreadStatusBadgeProps) {
  const statusConfig = {
    active: {
      label: 'Active',
      color: 'bg-green-100 text-green-800',
      icon: '●'
    },
    closing: {
      label: 'Closing',
      color: 'bg-yellow-100 text-yellow-800',
      icon: '◐'
    },
    resolved: {
      label: 'Resolved',
      color: 'bg-blue-100 text-blue-800',
      icon: '✓'
    },
    escalated: {
      label: 'Escalated',
      color: 'bg-red-100 text-red-800',
      icon: '⚠'
    },
    closed: {
      label: 'Closed',
      color: 'bg-gray-100 text-gray-800',
      icon: '✕'
    }
  };

  const config = statusConfig[status];

  return (
    <Badge className={config.color}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
```

**Thread List with Lifecycle**:

```typescript
// Enhanced conversations list page
export default function ConversationsListPage() {
  // ... existing code ...

  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <Card key={thread.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <ThreadStatusBadge status={thread.status} />
                <Badge variant="outline">{thread.channel}</Badge>
              </div>

              <h3 className="font-semibold text-lg mb-1">
                {thread.subject}
              </h3>

              <p className="text-sm text-gray-600 mb-2">
                {thread.tenant_name} • {formatDate(thread.created_at)}
              </p>

              {/* Closure confidence indicator */}
              {thread.closure_confidence && (
                <div className="text-xs text-gray-500 mb-2">
                  Closure confidence: {Math.round(thread.closure_confidence * 100)}%
                  {thread.closure_factors && (
                    <details className="inline ml-2">
                      <summary className="cursor-pointer underline">Details</summary>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs">
                        {JSON.stringify(thread.closure_factors, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Activity timeline */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Started: {formatDateTime(thread.created_at)}</div>
                <div>Last activity: {formatDateTime(thread.last_activity_at)}</div>
                {thread.resolved_at && (
                  <div>Resolved: {formatDateTime(thread.resolved_at)}</div>
                )}
                {thread.closed_at && (
                  <div>Closed: {formatDateTime(thread.closed_at)}</div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 ml-4">
              {thread.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCloseThread(thread.id)}
                >
                  Mark as Closing
                </Button>
              )}
              {(thread.status === 'active' || thread.status === 'closing') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleForceCloseThread(thread.id)}
                >
                  Close Thread
                </Button>
              )}
              {(thread.status === 'resolved' || thread.status === 'closed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReopenThread(thread.id)}
                >
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### Phase 6: Testing Strategy

#### 6.1 Test Scenarios

1. **New Conversation Start**
   - First message from new tenant
   - Message after 48+ hour gap
   - Completely different topic
   - Greeting + new question

2. **Conversation Continuation**
   - Follow-up question
   - Clarification request
   - Related to same topic
   - Acknowledgment response

3. **Conversation Closure**
   - "Thank you" message
   - "All set" message
   - Issue resolved confirmation
   - Inactivity period

4. **Edge Cases**
   - Multiple rapid messages
   - Topic changes mid-conversation
   - Reopening closed threads
   - Manual manager intervention

## Implementation Order

1. ✅ Database migrations (conversation_events table, new columns)
2. ✅ Enhanced AI analysis methods (start detection, multi-factor closure)
3. ✅ Update message/webhook routes to use enhanced detection
4. ✅ Add inactivity-based auto-closure service
5. ✅ Add manager control endpoints (close/reopen)
6. ✅ Update dashboard UI with lifecycle display
7. ✅ Add scheduled task for auto-closure
8. ✅ Testing across all scenarios

## Success Metrics

- 95%+ accuracy in detecting conversation starts
- 90%+ accuracy in detecting conversation closures
- <5% false positive closures
- <5% false negative closures (missed closures)
- Manager satisfaction with thread management
- Reduced manual thread management effort

## Migration Path

All changes are backward compatible:

- Existing threads will continue to work
- New columns have defaults
- New status values are additions
- Dashboard will gracefully handle missing data
