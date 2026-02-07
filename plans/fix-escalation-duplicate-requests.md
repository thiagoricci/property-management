# Fix Escalation Duplicate Maintenance Requests

## Problem Statement

When users escalate an existing maintenance request (e.g., "It's getting worse, make it emergency"), the AI assistant creates a new maintenance request instead of updating the existing one. This results in duplicate requests for the same issue.

## Root Cause Analysis

### Issue 1: Time Windows Are Too Short

**Pre-action duplicate check** (src/routes/messages.js:1065):

- Only checks requests from last **24 hours**
- Escalations often happen days or weeks after initial report

**Rule-based deduplication** (src/routes/messages.js:783):

- Query checks last **24 hours** but log says "1 hour" (inconsistent)
- Too short for real-world escalation scenarios

**Impact**: If a user escalates a request after 24 hours, it won't be caught by these layers.

### Issue 2: AI Not Including `existing_request_id`

The AI system prompt has detailed instructions (src/services/aiService.js:135-207), but:

1. AI might not be reading the open maintenance requests context properly
2. AI might not be following instructions to include `existing_request_id`
3. Escalation patterns might not be recognized as "same issue"

**Impact**: If AI doesn't include `existing_request_id`, Layer 1 (AI Reference) won't catch it.

### Issue 3: Escalation Detection Weak

The system lacks explicit escalation detection patterns:

- "it's getting worse"
- "make it emergency"
- "escalate this"
- "urgent now"
- "priority change"
- "actually it's..."

**Impact**: AI treats escalation as a new issue instead of an update.

### Issue 4: Confidence Thresholds May Be Too Strict

**Cross-thread deduplication** (src/routes/messages.js:710):

- Confidence threshold is **0.3** (30%)
- This might be too low, causing false positives OR
- The AI analysis might not be confident enough

**Impact**: Escalations might not be recognized as duplicates.

### Issue 5: Clarification Flow Has Critical Flaw

The clarification flow (src/routes/messages.js:89-380) has issues:

1. It only asks clarification if `clarification_asked === false`
2. Once clarification is asked, it's never asked again
3. If AI creates a new request during clarification flow (line 197-277), it bypasses duplicate checks

**Impact**: Escalations during clarification flow create new requests.

## Proposed Solution

### Phase 1: Expand Time Windows

**Change 1: Expand pre-action check to 7 days**

```javascript
// Before: 24 hours
AND created_at > NOW() - INTERVAL '24 hours'

// After: 7 days
AND created_at > NOW() - INTERVAL '7 days'
```

**Change 2: Expand rule-based deduplication to 7 days**

```javascript
// Before: 24 hours
AND created_at > NOW() - INTERVAL '24 hours'

// After: 7 days
AND created_at > NOW() - INTERVAL '7 days'
```

**Change 3: Fix inconsistent log message**

```javascript
// Line 793: Fix log to match query
console.log(
  `[Rule-Based Deduplication] Found ${recentRequests.rows.length} recent request(s) in last 7 days`,
);
```

### Phase 2: Enhance AI System Prompt

**Add explicit escalation instructions** to `buildSystemPrompt()` in `aiService.js`:

```javascript
const escalationInstructions = `
ESCALATION DETECTION CRITICAL:

When tenant message indicates ESCALATION of existing issue, you MUST include "existing_request_id":

ESCALATION PATTERNS (MUST UPDATE EXISTING REQUEST):
- "it's getting worse"
- "make it emergency"
- "escalate this"
- "urgent now"
- "priority change"
- "actually it's..."
- "the problem is worsening"
- "this is an emergency now"
- "need this fixed ASAP"

EXAMPLES OF ESCALATION (include existing_request_id):
✅ "The leak is getting worse" → update existing leak request with emergency priority
✅ "It's actually an emergency" → update existing request with emergency priority
✅ "Make this urgent, it's flooding" → update existing request with urgent priority
✅ "Escalate this to emergency" → update existing request with emergency priority

CRITICAL: If tenant's message contains escalation patterns, you MUST:
1. Find the matching open maintenance request
2. Include "existing_request_id": <ID> in your action
3. Update the priority if tenant mentions emergency/urgent
4. DO NOT create a new request

${
  maintenanceContext
    ? `
CURRENT OPEN MAINTENANCE REQUESTS:
${maintenanceContext}`
    : ""
}
`;
```

**Add escalation instructions to system prompt**:

```javascript
return `You are Alice, an AI property manager. Your role is to assist tenants with their questions, concerns, and requests.

${propertyContext}

${tenantContext}

${faqContext}

${duplicatePreventionInstructions}

${escalationInstructions}  // NEW: Add escalation instructions

Your responsibilities:
...
`;
```

### Phase 3: Add Escalation-Specific Detection

**Create new function** `detectEscalation()` in `messages.js`:

```javascript
/**
 * Detect if message is an escalation of existing issue
 * @param {String} message - Tenant message
 * @returns {Object} { isEscalation: boolean, confidence: number, priority: string|null }
 */
async function detectEscalation(message) {
  const escalationPatterns = [
    { pattern: /getting worse/i, priority: "urgent" },
    { pattern: /make it emergency/i, priority: "emergency" },
    { pattern: /escalate/i, priority: "urgent" },
    { pattern: /urgent now/i, priority: "urgent" },
    { pattern: /actually it's/i, priority: null },
    { pattern: /worsening/i, priority: "urgent" },
    { pattern: /emergency now/i, priority: "emergency" },
    { pattern: /need this fixed ASAP/i, priority: "urgent" },
    { pattern: /it's flooding/i, priority: "emergency" },
  ];

  for (const { pattern, priority } of escalationPatterns) {
    if (pattern.test(message)) {
      return {
        isEscalation: true,
        confidence: 0.9,
        priority: priority,
      };
    }
  }

  return { isEscalation: false, confidence: 0.0, priority: null };
}
```

**Integrate escalation detection into pre-action check**:

```javascript
async function preActionDuplicateCheck(
  action,
  tenantId,
  propertyId,
  messageId,
  userMessage,
) {
  // Only check maintenance_request actions
  if (action.action !== "maintenance_request") {
    return null;
  }

  const { priority, description, existing_request_id } = action;

  // NEW: Check if this is an escalation
  const escalationCheck = await detectEscalation(userMessage);

  if (escalationCheck.isEscalation) {
    console.log(
      `[Pre-Action Deduplication] Escalation detected! Priority: ${escalationCheck.priority}`,
    );

    // Find most recent open request for this tenant
    const recentRequest = await db.query(
      `SELECT * FROM maintenance_requests
       WHERE tenant_id = $1
       AND property_id = $2
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, propertyId],
    );

    if (recentRequest.rows.length > 0) {
      return {
        type: "escalation",
        requestId: recentRequest.rows[0].id,
        confidence: escalationCheck.confidence,
        reasoning: "Escalation detected by pattern matching",
        suggestedPriority: escalationCheck.priority,
      };
    }
  }

  // If AI already provided existing_request_id, use it
  if (existing_request_id) {
    console.log(
      `[Pre-Action Deduplication] AI provided existing_request_id: ${existing_request_id}`,
    );
    return {
      type: "ai_provided",
      requestId: existing_request_id,
      confidence: 1.0,
      reasoning: "AI explicitly identified existing request",
    };
  }

  // Rest of existing logic...
}
```

**Update executeAction to pass userMessage**:

```javascript
async function executeAction(
  action,
  tenantId,
  propertyId,
  threadId,
  messageId,
  userMessage,
) {
  switch (action.action) {
    case "maintenance_request":
      // LAYER 0: Pre-action duplicate check (pass userMessage)
      const duplicateCheck = await preActionDuplicateCheck(
        action,
        tenantId,
        propertyId,
        messageId,
        userMessage, // NEW: Pass user message for escalation detection
      );

      if (duplicateCheck) {
        console.log(
          `[Action Execution] Duplicate detected, updating existing request ${duplicateCheck.requestId}`,
        );

        // Use suggested priority from escalation detection
        const updatePriority =
          duplicateCheck.suggestedPriority || action.priority;

        return await updateExistingRequest(
          duplicateCheck.requestId,
          updatePriority,
          action.description,
          tenantId,
          propertyId,
          duplicateCheck.type,
        );
      }

    // Rest of existing logic...
  }
}
```

**Update POST /api/messages to pass userMessage**:

```javascript
for (const action of deduplicatedActions) {
  try {
    const result = await executeAction(
      action,
      tenant.id,
      property ? property.id : null,
      threadId,
      savedResponse.id,
      message  // NEW: Pass original user message
    );

    // Rest of existing logic...
  }
}
```

### Phase 4: Fix Clarification Flow

**Remove bypass of duplicate checks** in clarification flow (lines 197-277):

```javascript
// BEFORE (line 197-277): Creates new request without duplicate checks
} else {
  // Different issue - create new request
  console.log(`[Clarification Flow] Tenant confirmed different issue, creating new request`);

  // Extract actions from AI to get maintenance request details
  const tempAnalysis = await aiService.generateResponseWithAnalysis(
    property,
    tenant,
    conversationHistory,
    message,
    maintenanceResult.rows,
    activeThread
  );

  const actions = aiService.extractActions(tempAnalysis.response);
  const deduplicatedActions = aiService.deduplicateActions(actions);

  // Execute actions (should create new request)
  const executedActions = [];
  for (const action of deduplicatedActions) {
    try {
      const result = await executeAction(
        action,
        tenant.id,
        property ? property.id : null,
        activeThread.id,
        null // No message ID yet
      );
      executedActions.push({ ...action, status: "executed", result });
    } catch (error) {
      console.error("Failed to execute action:", error);
      executedActions.push({ ...action, status: "failed", error: error.message });
    }
  }
  // ...
}

// AFTER: Use executeAction which includes duplicate checks
} else {
  // Different issue - create new request
  console.log(`[Clarification Flow] Tenant confirmed different issue, creating new request`);

  // Extract actions from AI to get maintenance request details
  const tempAnalysis = await aiService.generateResponseWithAnalysis(
    property,
    tenant,
    conversationHistory,
    message,
    maintenanceResult.rows,
    activeThread
  );

  const actions = aiService.extractActions(tempAnalysis.response);
  const deduplicatedActions = aiService.deduplicateActions(actions);

  // Execute actions with duplicate checks
  const executedActions = [];
  for (const action of deduplicatedActions) {
    try {
      const result = await executeAction(
        action,
        tenant.id,
        property ? property.id : null,
        activeThread.id,
        null, // No message ID yet
        message  // NEW: Pass user message for escalation detection
      );
      executedActions.push({ ...action, status: "executed", result });
    } catch (error) {
      console.error("Failed to execute action:", error);
      executedActions.push({ ...action, status: "failed", error: error.message });
    }
  }
  // ...
}
```

### Phase 5: Improve AI Confidence

**Adjust cross-thread deduplication confidence threshold**:

```javascript
// Line 710: Lower threshold for more aggressive detection
// BEFORE: Confidence >= 0.3 → same issue
if (result.is_same_issue && result.confidence >= 0.3 && result.existing_request_id) {

// AFTER: Confidence >= 0.25 → same issue (even more aggressive)
if (result.is_same_issue && result.confidence >= 0.25 && result.existing_request_id) {
```

**Add more examples to cross-thread deduplication prompt**:

```javascript
// Add to prompt (around line 726):
EXAMPLES:

Example 1 - Escalation (Update Existing):
Time gap: 3 days, Same channel, Same subject, Priority change
→ is_same_issue: true, should_update_existing: true, action: "update_existing"

Example 2 - Same Issue Different Description (Update Existing):
Time gap: 5 days, Same channel, Similar subject
→ is_same_issue: true, should_update_existing: true, action: "update_existing"

Example 3 - Different Issue (Create New):
Time gap: 1 day, Different channel, Completely different subject
→ is_same_issue: false, should_update_existing: false, action: "create_new_independent"
```

## Implementation Order

1. **Phase 1: Expand Time Windows** (Quick fix, high impact)
   - Update pre-action check to 7 days
   - Update rule-based deduplication to 7 days
   - Fix inconsistent log message

2. **Phase 2: Add Escalation Detection** (Medium effort, high impact)
   - Create `detectEscalation()` function
   - Update `preActionDuplicateCheck()` to use escalation detection
   - Update `executeAction()` to pass userMessage
   - Update POST /api/messages to pass userMessage

3. **Phase 3: Enhance AI System Prompt** (Medium effort, medium impact)
   - Add escalation instructions to `buildSystemPrompt()`
   - Add more examples of escalation patterns

4. **Phase 4: Fix Clarification Flow** (Low effort, medium impact)
   - Remove bypass of duplicate checks in clarification flow
   - Ensure all paths go through `executeAction()`

5. **Phase 5: Improve AI Confidence** (Low effort, low impact)
   - Lower cross-thread confidence threshold
   - Add more examples to prompt

## Testing Strategy

### Test Scenario 1: Simple Escalation

1. User: "My sink is leaking" (creates request #1)
2. User: "It's getting worse" (should update request #1)
3. Expected: Request #1 updated, not new request created

### Test Scenario 2: Priority Escalation

1. User: "AC not working" (creates request #1, priority: normal)
2. User: "Make it emergency, it's 90 degrees" (should update request #1 to emergency)
3. Expected: Request #1 updated to emergency priority

### Test Scenario 3: Time-Based Escalation

1. User: "Leaky faucet" (creates request #1 on day 1)
2. User: "Still leaking, need it fixed" (on day 5, should update request #1)
3. Expected: Request #1 updated, not new request created

### Test Scenario 4: Different Issue

1. User: "Sink leaking" (creates request #1)
2. User: "AC broken" (should create request #2)
3. Expected: Two separate requests created

## Success Criteria

- ✅ Escalations within 7 days update existing requests
- ✅ Priority changes update existing requests
- ✅ "Getting worse" patterns update existing requests
- ✅ No duplicate requests for same issue
- ✅ Different issues still create new requests
- ✅ Clarification flow respects duplicate checks
- ✅ AI includes `existing_request_id` for escalations

## Rollback Plan

If changes cause issues:

1. Revert time windows to 24 hours
2. Disable escalation detection (comment out)
3. Revert AI system prompt changes
4. Restore clarification flow bypass

## Files to Modify

1. `src/routes/messages.js`
   - Expand time windows (lines 1065, 783)
   - Add `detectEscalation()` function
   - Update `preActionDuplicateCheck()` function
   - Update `executeAction()` function
   - Update POST /api/messages endpoint
   - Fix clarification flow

2. `src/services/aiService.js`
   - Add escalation instructions to `buildSystemPrompt()`
   - Enhance duplicate prevention examples

## Estimated Effort

- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 30 minutes
- Phase 4: 20 minutes
- Phase 5: 15 minutes
- **Total: ~2.5 hours**

## Next Steps

1. Review and approve this plan
2. Switch to Code mode to implement
3. Test with escalation scenarios
4. Update memory bank with changes
