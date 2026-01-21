# Fix Duplicate Maintenance Requests & Remove "Maintenance Request:" Text

## Problem Summary

### Issue 1: Duplicate Maintenance Requests

**Symptom**: System creates multiple maintenance requests for the same issue when AI generates multiple JSON blocks with slightly different descriptions.

**Example**:

- Request 1: "electrical outage in unit"
- Request 2: "power outage in apartment"
- Request 3: "no electricity in home"

All three refer to the same issue but are not deduplicated because the current logic only removes EXACT duplicates.

### Issue 2: "Maintenance Request:" Text in Responses

**Symptom**: AI responses include conversational text like "Maintenance Request:" that is not being removed by the `stripJSONFromResponse()` method.

**Example Response**:

```
Thank you for confirming that the electrical outage is specific to your unit, Thiago. Since it's isolated to your home, I recommend refraining from attempting any electrical fixes yourself to ensure safety. I will escalate this as an urgent maintenance request to have our team address the electrical outage in your unit promptly. Our maintenance staff will investigate the cause and work to restore power to your home as soon as possible. Maintenance Request:
```

The "Maintenance Request:" text should be removed for cleaner user-facing responses.

---

## Root Cause Analysis

### Issue 1: Duplicate Maintenance Requests

**Current Deduplication Logic** ([`src/services/aiService.js:159-181`](src/services/aiService.js:159-181)):

```javascript
const key = `${action.action}:${action.description || ""}:${action.priority || ""}`;
```

This only removes duplicates when ALL three fields match exactly:

- Action type
- Description (exact string match)
- Priority

**Why It Fails**:

- AI can generate multiple maintenance request JSON blocks for the same issue
- Descriptions may vary (e.g., "electrical outage" vs "power outage")
- Same issue, different wording → No deduplication → Multiple requests created

### Issue 2: "Maintenance Request:" Text

**Current Text Cleaning** ([`src/services/aiService.js:235-243`](src/services/aiService.js:235-243)):

```javascript
stripJSONFromResponse(response) {
  let cleaned = response.replace(/\{[\s\S]*?\}/g, "").trim();
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned;
}
```

**Why It Fails**:

- Only removes JSON blocks (anything between `{` and `}`)
- Does not remove conversational text like "Maintenance Request:"
- AI is adding this text before JSON blocks per system prompt instructions

---

## Solution Design

### Solution 1: Multi-Layered Deduplication for Maintenance Requests

#### Layer 1: Exact Duplicate Deduplication (Keep Existing)

- Keep current [`deduplicateActions()`](src/services/aiService.js:159-181) method
- Removes identical JSON blocks within the same response

#### Layer 2: Time-Based Deduplication (NEW)

- Check for recently created maintenance requests for the same tenant
- If a request exists with the same priority within the last 5 minutes, skip creating a new one
- This catches cases where AI generates multiple requests in rapid succession

**Implementation**:

```javascript
async function checkForRecentDuplicate(tenantId, priority, description) {
  const result = await db.query(
    `SELECT * FROM maintenance_requests
     WHERE tenant_id = $1
     AND priority = $2
     AND created_at > NOW() - INTERVAL '5 minutes'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, priority],
  );

  if (result.rows.length > 0) {
    const recent = result.rows[0];
    // Simple similarity check: if descriptions share key words
    const recentWords = new Set(
      recent.issue_description.toLowerCase().split(/\s+/),
    );
    const newWords = new Set(description.toLowerCase().split(/\s+/));
    const intersection = [...recentWords].filter((word) => newWords.has(word));

    // If 50%+ words match, consider it a duplicate
    if (
      intersection.length / Math.max(recentWords.size, newWords.size) >=
      0.5
    ) {
      console.log(
        `[Time-Based Deduplication] Skipping duplicate request for tenant ${tenantId}`,
      );
      return recent;
    }
  }

  return null;
}
```

#### Layer 3: AI Prompt Improvement (OPTIONAL)

- Update system prompt to explicitly instruct AI to include only ONE maintenance request JSON block
- Add examples showing correct vs incorrect format

**Prompt Addition**:

```
CRITICAL: Include ONLY ONE JSON block per action type. Do not repeat the same action multiple times.

✅ CORRECT (one maintenance request):
"I'll create a maintenance request for your issue.
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Power outage in unit"
}"

❌ INCORRECT (duplicate maintenance requests):
"I'll create a maintenance request for your issue.
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Power outage in unit"
}
{
  "action": "maintenance_request",
  "priority": "urgent",
  "description": "Electrical outage in apartment"
}"
```

### Solution 2: Enhanced Text Cleaning

#### Approach 1: Remove Phrases Before JSON Blocks

- Modify [`stripJSONFromResponse()`](src/services/aiService.js:235-243) to remove common phrases
- Use regex to remove patterns like "Maintenance Request:", "I'll create a maintenance request", etc.

**Implementation**:

```javascript
stripJSONFromResponse(response) {
  // Remove JSON action blocks
  let cleaned = response.replace(/\{[\s\S]*?\}/g, "").trim();

  // Remove common conversational phrases about maintenance requests
  const phrasesToRemove = [
    /Maintenance Request:?/gi,
    /I'll create a maintenance request/gi,
    /I am creating a maintenance request/gi,
    /Creating maintenance request/gi,
    /Maintenance request created/gi,
  ];

  phrasesToRemove.forEach(regex => {
    cleaned = cleaned.replace(regex, "");
  });

  // Remove extra whitespace and newlines
  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned;
}
```

#### Approach 2: Improve AI Prompt (RECOMMENDED)

- Instruct AI to NOT include conversational text about creating maintenance requests
- Just include the JSON block at the end

**Prompt Addition**:

```
IMPORTANT: Do NOT include conversational text like "Maintenance Request:" or "I'll create a maintenance request" in your response. Simply provide your helpful response, and include the JSON action block at the very END.
```

---

## Implementation Plan

### Step 1: Update AI System Prompt

**File**: [`src/services/aiService.js`](src/services/aiService.js:53-123)

**Changes**:

1. Add instruction to include only ONE JSON block per action type
2. Add instruction to NOT include conversational text about creating maintenance requests
3. Add examples showing correct vs incorrect format

**Lines to modify**: 100-122

### Step 2: Add Time-Based Deduplication

**File**: [`src/routes/messages.js`](src/routes/messages.js:144-222)

**Changes**:

1. Add `checkForRecentDuplicate()` function before [`createMaintenanceRequest()`](src/routes/messages.js:166-222)
2. Call this function in [`executeAction()`](src/routes/messages.js:144-161) for maintenance requests
3. Skip creation if duplicate found
4. Log deduplication events

**Lines to modify**: 144-222

### Step 3: Enhance Text Cleaning

**File**: [`src/services/aiService.js`](src/services/aiService.js:235-243)

**Changes**:

1. Update [`stripJSONFromResponse()`](src/services/aiService.js:235-243) to remove common phrases
2. Add regex patterns for phrases like "Maintenance Request:", "I'll create a maintenance request"
3. Test with various AI response formats

**Lines to modify**: 235-243

### Step 4: Apply Same Changes to Webhooks

**File**: [`src/routes/webhooks.js`](src/routes/webhooks.js)

**Changes**:

1. Add same time-based deduplication logic to SMS endpoint
2. Add same time-based deduplication logic to email endpoint
3. Ensure consistency across all message channels

**Lines to modify**: SMS endpoint (lines 108-143), Email endpoint (lines 274-313)

### Step 5: Test the Fixes

**File**: Create new test script `scripts/test-fixes.js`

**Test Cases**:

1. Test exact duplicate deduplication (existing)
2. Test time-based deduplication with similar descriptions
3. Test text cleaning with "Maintenance Request:" phrase
4. Test that legitimate different requests are still created
5. Test all three message channels (API, SMS, email)

### Step 6: Monitor and Iterate

- Monitor logs for deduplication events
- Track duplicate request rate
- Review AI response quality
- Adjust time window (5 minutes) if needed
- Adjust similarity threshold (50%) if needed

---

## Expected Outcomes

### Issue 1: Duplicate Maintenance Requests

- **Before**: Multiple maintenance requests created for same issue
- **After**: Only one maintenance request created per unique issue within 5-minute window
- **Success Metric**: Duplicate request rate < 5%

### Issue 2: "Maintenance Request:" Text

- **Before**: Responses include conversational filler like "Maintenance Request:"
- **After**: Responses are clean and professional without unnecessary text
- **Success Metric**: 100% of responses cleaned successfully

---

## Files to Modify

1. [`src/services/aiService.js`](src/services/aiService.js)
   - Update `buildSystemPrompt()` method (lines 53-123)
   - Update `stripJSONFromResponse()` method (lines 235-243)

2. [`src/routes/messages.js`](src/routes/messages.js)
   - Add `checkForRecentDuplicate()` function (new function)
   - Update `executeAction()` function (lines 144-161)

3. [`src/routes/webhooks.js`](src/routes/webhooks.js)
   - Add `checkForRecentDuplicate()` function (new function)
   - Update SMS endpoint action execution (lines 128-143)
   - Update email endpoint action execution (lines 274-313)

4. [`scripts/test-fixes.js`](scripts/test-fixes.js)
   - Create comprehensive test suite (new file)

---

## Risk Assessment

### Low Risk

- AI prompt changes may slightly alter response style
- Time-based deduplication may miss some edge cases

### Mitigation

- Monitor AI response quality after prompt changes
- Adjust time window and similarity threshold based on real-world usage
- Keep existing exact duplicate deduplication as fallback

---

## Rollback Plan

If issues arise after deployment:

1. Revert AI prompt changes to previous version
2. Remove time-based deduplication logic
3. Keep exact duplicate deduplication (minimal risk)
4. Monitor and investigate root cause

---

## Success Criteria

- [ ] AI prompt updated with clear instructions
- [ ] Time-based deduplication implemented in messages.js
- [ ] Time-based deduplication implemented in webhooks.js
- [ ] Text cleaning enhanced to remove "Maintenance Request:" phrases
- [ ] All test cases pass
- [ ] Duplicate request rate reduced to < 5%
- [ ] AI responses are clean without unnecessary text
- [ ] No regressions in existing functionality
- [ ] Documentation updated

---

## Next Steps

1. Review and approve this plan
2. Implement Step 1: Update AI System Prompt
3. Implement Step 2: Add Time-Based Deduplication
4. Implement Step 3: Enhance Text Cleaning
5. Implement Step 4: Apply Changes to Webhooks
6. Implement Step 5: Test the Fixes
7. Implement Step 6: Monitor and Iterate
8. Deploy to production
9. Monitor metrics and adjust as needed

---

**Status**: 📋 PLAN READY FOR APPROVAL
**Estimated Implementation Time**: 2-3 hours
**Priority**: HIGH (affects user experience and data integrity)
