# Fix Duplicate Maintenance Requests

## Problem Statement

The AI assistant is creating multiple maintenance requests for the same issue in a single conversation. In one conversation, the AI created 3 requests for the same issue. The expected behavior is to create only one request per issue.

## Root Cause Analysis

### Current Behavior

1. AI generates response and may include multiple JSON blocks for the same action
2. `extractActions()` method in `aiService.js` uses regex `/\{[\s\S]*?\}/g` to find ALL JSON blocks
3. Action execution loop in `messages.js` and `webhooks.js` processes ALL actions without deduplication
4. Result: Multiple maintenance requests created for the same issue

### Code Flow

```
AI Response → extractActions() → [Action1, Action2, Action1] → Execute All → 3 Requests Created
```

### Example Problem Scenario

```javascript
// AI Response (simplified)
"I'll create a maintenance request for your leaking sink.
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Leaking sink in kitchen"
}
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Leaking sink in kitchen"
}
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Leaking sink in kitchen"
}"

// extractActions() returns 3 identical actions
// Action execution creates 3 maintenance requests
```

## Solution Design

### Multi-Layered Approach

#### Layer 1: Improve AI System Prompt (Preventative)

- Make it explicit that AI should include ONLY ONE JSON block per action type
- Add examples of correct and incorrect JSON block usage
- Emphasize avoiding duplicate actions
- Update `buildSystemPrompt()` method in `aiService.js`

**Updated Prompt Section:**

```
IMPORTANT: When you identify a maintenance issue, you MUST include ONE JSON object at the END of your response:
{
  "action": "maintenance_request",
  "priority": "emergency|urgent|normal|low",
  "description": "detailed description of issue"
}

CRITICAL: Include ONLY ONE JSON block per action type. Do not repeat the same action multiple times.
```

#### Layer 2: Action Deduplication Logic (Defensive)

- Create `deduplicateActions()` method in `aiService.js`
- Deduplicate based on action type + description + priority
- Keep only the first occurrence of each unique action
- Log deduplication for monitoring

**Deduplication Logic:**

```javascript
deduplicateActions(actions) {
  const uniqueActions = [];
  const seen = new Set();

  for (const action of actions) {
    // Create unique key based on action type and description
    const key = `${action.action}:${action.description || ''}:${action.priority || ''}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueActions.push(action);
    } else {
      console.log(`Deduplicating duplicate action: ${key}`);
    }
  }

  return uniqueActions;
}
```

#### Layer 3: Update Action Execution (Implementation)

- Use deduplicated actions before executing in both `messages.js` and `webhooks.js`
- Update action extraction calls to include deduplication step
- Apply to all webhook endpoints (SMS, email)

**Updated Flow:**

```
AI Response → extractActions() → deduplicateActions() → [Action1, Action2] → Execute → 2 Requests Created
```

## Implementation Plan

### Step 1: Update AI System Prompt

**File:** `src/services/aiService.js`
**Method:** `buildSystemPrompt()`

Changes:

1. Add explicit instruction to include only ONE JSON block per action type
2. Add examples of correct and incorrect usage
3. Emphasize avoiding duplicate actions

### Step 2: Implement Action Deduplication

**File:** `src/services/aiService.js`
**New Method:** `deduplicateActions(actions)`

Implementation:

1. Accept array of actions
2. Create unique key for each action (type + description + priority)
3. Use Set to track seen actions
4. Return deduplicated array
5. Log deduplication events

### Step 3: Update Action Execution in messages.js

**File:** `src/routes/messages.js`
**Location:** After `extractActions()` call

Changes:

1. Call `deduplicateActions()` on extracted actions
2. Use deduplicated actions for execution
3. Log deduplication statistics

### Step 4: Update Action Execution in webhooks.js

**File:** `src/routes/webhooks.js`
**Location:** After `extractActions()` call in both SMS and email endpoints

Changes:

1. Call `deduplicateActions()` on extracted actions
2. Use deduplicated actions for execution
3. Log deduplication statistics

### Step 5: Testing

**Test Scenarios:**

1. Single maintenance request - should create 1 request
2. Multiple different issues - should create multiple requests
3. Same issue reported multiple times in conversation - should create 1 request
4. Emergency with alert - should create 1 request + 1 alert
5. No actions - should not create any requests

### Step 6: Documentation

**Documentation:**

1. Update `plans/FIX_DUPLICATE_MAINTENANCE_REQUESTS.md` with implementation details
2. Add comments in code explaining deduplication logic
3. Update memory bank if needed

## Expected Outcomes

### Before Fix

- Single issue reported → 3 maintenance requests created
- Multiple duplicate JSON blocks in AI response
- No deduplication logic
- Wasted database entries and notifications

### After Fix

- Single issue reported → 1 maintenance request created
- AI instructed to include only one JSON block per action
- Deduplication logic removes duplicates
- Clean database with unique actions

## Benefits

1. **Data Integrity**: No duplicate maintenance requests in database
2. **Cost Savings**: Fewer notifications sent to managers and tenants
3. **Better UX**: Property managers see unique issues, not duplicates
4. **Reliability**: Defensive approach works even if AI doesn't follow instructions perfectly
5. **Monitoring**: Logging helps identify AI behavior patterns

## Technical Details

### Deduplication Key Strategy

The deduplication key combines:

- `action`: The action type (maintenance_request, alert_manager)
- `description`: The issue description (for maintenance_request)
- `priority`: The priority level (for maintenance_request)

This ensures:

- Different issues are treated as separate actions
- Same issue with different priority is treated as separate
- Different action types are never deduplicated

### Edge Cases Handled

1. **Missing fields**: Actions without description/priority still deduplicated by action type
2. **Empty description**: Treated as empty string in key
3. **Case sensitivity**: Keys are case-sensitive (maintains exact matching)
4. **Order preservation**: First occurrence is kept, subsequent duplicates removed

## Rollback Plan

If issues arise:

1. Remove deduplication call from `messages.js` and `webhooks.js`
2. Revert system prompt changes in `aiService.js`
3. Keep `deduplicateActions()` method for potential future use
4. Monitor for duplicate requests in logs

## Success Criteria

- [ ] AI generates only one JSON block per action type in 90%+ of responses
- [ ] Deduplication logic removes 100% of duplicate actions
- [ ] Single issue creates exactly 1 maintenance request
- [ ] Multiple different issues create multiple maintenance requests
- [ ] No regressions in existing functionality
- [ ] Logging shows deduplication events when they occur
