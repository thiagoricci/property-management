# Enhanced AI Issue Tracking & Duplicate Prevention

## Objective

Make the AI more conservative in assuming tenants are referring to the same issue, reducing duplicate maintenance requests by improving AI's ability to detect when a new message is about an existing problem.

## Current System Analysis

### Existing Deduplication Layers

The system currently has a 5-layer deduplication approach:

1. **Layer 0: Pre-Action Duplicate Check**
   - AI analysis with 0.6 confidence threshold
   - Checks for escalation patterns
   - Analyzes similar requests in last 7 days

2. **Layer 0.5: Semantic Similarity Check**
   - No time limit
   - 0.6 confidence threshold
   - Checks ALL open/in-progress requests

3. **Layer 1: AI Explicit Reference**
   - AI provides `existing_request_id` in action
   - Direct reference to existing request

4. **Layer 2: Rule-Based Deduplication**
   - 30% keyword overlap threshold
   - 1-hour time window
   - Priority escalation detection (20% threshold)
   - Location-based deduplication

5. **Layer 3: AI-Based Cross-Thread Deduplication**
   - 0.25 confidence threshold (already low)
   - 30-day time window
   - Semantic analysis across threads

6. **Layer 4: Create New Request**
   - Only if all previous layers fail

### Current Issues

1. **Inconsistent Thresholds**: Some layers use 0.6, others use 0.25
2. **Time Windows**: Varying time windows (1 hour, 7 days, 30 days, no limit)
3. **AI Prompts**: While comprehensive, could be more aggressive about assuming same issue
4. **No Conversation Context**: Doesn't analyze full conversation thread for issue continuity

## Enhancement Strategy

### Phase 1: Make AI More Conservative (Assume Same Issue)

#### 1.1 Update System Prompt - "Assume Same Issue" Philosophy

**File**: `src/services/aiService.js` - `buildSystemPrompt()`

**Changes**:

- Move duplicate prevention to TOP of prompt (already done)
- Add explicit instruction: "When in doubt, ASSUME it's the same issue"
- Lower confidence threshold from 60% to 40% for creating new request
- Add more examples of "same issue" scenarios
- Emphasize that time doesn't matter for same issue detection

**New Prompt Section**:

```
CRITICAL - ASSUME SAME ISSUE BY DEFAULT:

Before creating ANY maintenance_request, you MUST follow this rule:

DEFAULT ASSUMPTION: Treat ALL new messages as referring to an EXISTING issue, unless there is CLEAR and OBVIOUS evidence it's a DIFFERENT problem.

This is a CONSERVATIVE approach - it's better to update an old request than create a duplicate.

WHEN IN DOUBT → UPDATE EXISTING REQUEST
WHEN UNCERTAIN → UPDATE EXISTING REQUEST
WHEN 50/50 → UPDATE EXISTING REQUEST

Only create a NEW request if you are 80%+ confident it's a completely different issue.
```

#### 1.2 Lower Confidence Thresholds

**Files**: Multiple

**Changes**:

- `analyzeDuplicateWithAI()`: 0.6 → 0.4 (messages.js)
- `checkSemanticSimilarity()`: 0.6 → 0.35 (messages.js)
- `checkForSimilarMaintenanceRequest()`: 0.25 → 0.2 (messages.js)
- `analyzeMaintenanceRequestSimilarity()`: 0.5 → 0.35 (aiService.js)

**Rationale**: Lowering thresholds makes AI more likely to detect duplicates.

#### 1.3 Remove Time-Based Restrictions

**Changes**:

- Remove time windows from duplicate detection
- Check ALL open/in-progress requests regardless of age
- Only exclude resolved/closed requests

**Rationale**: A leak reported 2 days ago is still the same leak today. Time should not be a factor.

### Phase 2: Enhanced Conversation Context Analysis

#### 2.1 Add Full Thread Context to Duplicate Detection

**New Function**: `analyzeIssueContinuity()`

**Purpose**: Analyze if new message continues an ongoing issue from conversation history.

**Implementation**:

```javascript
async function analyzeIssueContinuity(
  newMessage,
  conversationHistory,
  openRequests,
) {
  // Build context from last 10 messages
  const recentContext = conversationHistory
    .slice(-10)
    .map((m) => `${m.message_type}: ${m.message || m.response}`)
    .join("\n");

  const prompt = `Analyze if this new message continues an EXISTING issue or starts a NEW one.

RECENT CONVERSATION HISTORY (last 10 messages):
${recentContext}

OPEN MAINTENANCE REQUESTS:
${openRequests.map((r) => `[ID: ${r.id}] ${r.issue_description}`).join("\n")}

NEW TENANT MESSAGE: "${newMessage}"

CRITICAL: Be VERY CONSERVATIVE. Assume this is about an EXISTING issue unless there is CLEAR evidence otherwise.

Return JSON:
{
  "is_continuation": true or false,
  "confidence": 0.0-1.0,
  "existing_request_id": ID if continuation, else null,
  "reasoning": "brief explanation"
}

CONTINUATION (is_continuation: true):
- Providing more details about existing issue
- Following up on previous problem
- Confirming or clarifying existing issue
- Escalating or de-escalating existing problem
- Saying "it's getting worse" or "actually it's..."
- ANY message related to previous discussion
- Same general topic (plumbing, heating, cooling, etc.)

NEW ISSUE (is_continuation: false):
- Completely different problem
- Different location/room/apartment
- Different property entirely
- Explicitly says "different issue" or "new problem"
- Time gap > 48 hours AND completely different topic

CONFIDENCE THRESHOLDS:
- Confidence >= 0.4 → continuation (update existing)
- Confidence < 0.4 → new issue (create new)

CRITICAL: When in doubt, mark as CONTINUATION. Better to update than duplicate.`;

  // Call OpenAI API...
}
```

#### 2.2 Integrate Issue Continuity Analysis

**Location**: In `executeAction()` before duplicate checks

**Flow**:

```
executeAction()
  ↓
analyzeIssueContinuity() - NEW LAYER -0.5
  ↓
If continuation found → updateExistingRequest()
  ↓
Else → continue to Layer 0 (preActionDuplicateCheck)
```

### Phase 3: Enhanced AI Prompts for Duplicate Detection

#### 3.1 Strengthen Pre-Action Check Prompt

**File**: `src/routes/messages.js` - `analyzeDuplicateWithAI()`

**Enhanced Prompt**:

```
You are analyzing if a new maintenance request is a DUPLICATE or DIFFERENT issue.

BE VERY CONSERVATIVE - Assume it's a DUPLICATE unless proven otherwise.

EXISTING REQUESTS (last 1 hour):
${existingDescriptions}

NEW REQUEST:
Action: ${action.action}
Priority: ${action.priority}
Description: "${action.description}"

ANALYSIS RULES:

1. DEFAULT ASSUMPTION: Treat as DUPLICATE
2. Look for ANY similarity, no matter how small
3. Same location = DUPLICATE
4. Same problem type = DUPLICATE
5. Follow-up = DUPLICATE
6. Escalation = DUPLICATE
7. Providing details = DUPLICATE

ONLY CREATE NEW IF:
- Completely different problem
- Different location/room
- Explicitly says "different issue"
- 80%+ confident it's different

Return JSON:
{
  "is_duplicate": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "existing_request_id": ID if duplicate, else null
}

CONFIDENCE THRESHOLDS (LOWERED):
- Confidence >= 0.4 → duplicate (was 0.6)
- Confidence < 0.4 → different (was 0.6)

CRITICAL: When in doubt, mark as DUPLICATE. Better to update than create duplicate.
```

#### 3.2 Enhance Semantic Similarity Prompt

**File**: `src/routes/messages.js` - `checkSemanticSimilarity()`

**Enhanced Prompt**:

```
Check if this is a duplicate of an EXISTING request.

EXISTING REQUESTS (ALL open/in-progress, no time limit):
${allRequests.rows.map(r => `[ID: ${r.id}] ${r.issue_description} (Priority: ${r.priority}, Created: ${r.created_at})`).join('\n')}

NEW REQUEST: "${description}"

CRITICAL INSTRUCTIONS:

1. Assume it's a DUPLICATE unless CLEARLY different
2. Time does NOT matter - a 2-day-old leak is still the same leak
3. Same location = DUPLICATE
4. Same problem type = DUPLICATE
5. Any similarity = DUPLICATE

Return JSON:
{
  "is_duplicate": true/false,
  "confidence": 0.0-1.0,
  "existing_request_id": ID if duplicate
}

Guidelines:
- Same problem described differently = duplicate
- Same location/room = duplicate
- Follow-up or escalation = duplicate
- Providing more details = duplicate
- When in doubt, mark as duplicate

CONFIDENCE THRESHOLDS (LOWERED):
- Confidence >= 0.35 → duplicate (was 0.6)
- Confidence < 0.35 → different (was 0.6)

CRITICAL: Time does NOT matter. A request 2 days ago about the same leak is STILL THE SAME ISSUE.
```

### Phase 4: Implement Enhanced Deduplication

#### 4.1 New Deduplication Layer Structure

```
Layer -1: Issue Continuity Analysis (NEW)
    ↓ Analyze conversation history for issue continuity
    ↓ If continuation found → update existing request
    ↓
Layer 0: Pre-Action Duplicate Check (ENHANCED)
    ↓ Lower threshold: 0.6 → 0.4
    ↓ Enhanced prompt with "assume duplicate" philosophy
    ↓
Layer 0.5: Semantic Similarity Check (ENHANCED)
    ↓ Lower threshold: 0.6 → 0.35
    ↓ Remove time limit (already done)
    ↓
Layer 1: AI Explicit Reference (UNCHANGED)
    ↓ AI provides existing_request_id
    ↓
Layer 2: Rule-Based Deduplication (UNCHANGED)
    ↓ 30% keyword overlap
    ↓ 1-hour time window
    ↓
Layer 3: AI-Based Cross-Thread Deduplication (ENHANCED)
    ↓ Lower threshold: 0.25 → 0.2
    ↓
Layer 4: Create New Request (LAST RESORT)
```

#### 4.2 Update executeAction() Function

**File**: `src/routes/messages.js`

**Changes**:

1. Add issue continuity analysis as first check
2. Update all confidence thresholds
3. Enhance logging for better tracking

**New Flow**:

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
      // LAYER -1: Issue continuity analysis (NEW)
      const continuityCheck = await analyzeIssueContinuity(
        userMessage,
        conversationHistory, // Need to pass this in
        maintenanceResult.rows, // Need to pass this in
      );

      if (continuityCheck.isContinuation && continuityCheck.confidence >= 0.4) {
        console.log(
          `[Layer -1: Issue Continuity] Continuation detected, updating request ${continuityCheck.existingRequestId}`,
        );
        return await updateExistingRequest(
          continuityCheck.existingRequestId,
          action.priority,
          action.description,
          tenantId,
          propertyId,
          "issue-continuity",
        );
      }

      // LAYER 0: Pre-action duplicate check (ENHANCED)
      const duplicateCheck = await preActionDuplicateCheck(
        action,
        tenantId,
        propertyId,
        messageId,
        userMessage,
      );

      if (duplicateCheck) {
        // ... existing code
      }

      // LAYER 0.5: Semantic similarity check (ENHANCED)
      const semanticCheck = await checkSemanticSimilarity(
        tenantId,
        propertyId,
        action.description,
      );

      if (semanticCheck) {
        // ... existing code
      }

      // LAYER 4: Create new request (LAST RESORT)
      return await createMaintenanceRequest(
        action,
        tenantId,
        propertyId,
        threadId,
        messageId,
      );
  }
}
```

### Phase 5: Testing & Validation

#### 5.1 Test Scenarios

**Scenario 1: Same Issue, Different Description**

- Message 1: "My sink is leaking"
- Message 2: "Water is dripping from the faucet"
- Expected: Update existing request

**Scenario 2: Same Issue, Escalation**

- Message 1: "My AC is not working well"
- Message 2: "It's getting worse, make it urgent"
- Expected: Update existing request with urgent priority

**Scenario 3: Same Issue, Location Clarification**

- Message 1: "There's a leak"
- Message 2: "Actually it's in the kitchen sink"
- Expected: Update existing request with location details

**Scenario 4: Different Issue**

- Message 1: "My sink is leaking"
- Message 2: "My AC is broken"
- Expected: Create new request

**Scenario 5: Same Issue, 2 Days Later**

- Message 1: "My sink is leaking"
- Message 2 (2 days later): "The leak is still there"
- Expected: Update existing request (time doesn't matter)

**Scenario 6: Same Issue, Different Channel**

- Message 1 (SMS): "My sink is leaking"
- Message 2 (Email): "Water is dripping from faucet"
- Expected: Update existing request across channels

#### 5.2 Metrics to Track

1. **Duplicate Prevention Rate**: % of requests prevented from being duplicates
2. **False Positive Rate**: % of times we incorrectly marked as duplicate
3. **False Negative Rate**: % of times we failed to detect actual duplicate
4. **Layer Effectiveness**: Which layer catches most duplicates
5. **User Feedback**: Tenant satisfaction with duplicate handling

## Implementation Steps

### Step 1: Update AI System Prompt

- [ ] Modify `buildSystemPrompt()` in `aiService.js`
- [ ] Add "assume same issue" philosophy
- [ ] Lower confidence threshold to 40%
- [ ] Add more examples

### Step 2: Lower Confidence Thresholds

- [ ] Update `analyzeDuplicateWithAI()` in `messages.js` (0.6 → 0.4)
- [ ] Update `checkSemanticSimilarity()` in `messages.js` (0.6 → 0.35)
- [ ] Update `checkForSimilarMaintenanceRequest()` in `messages.js` (0.25 → 0.2)
- [ ] Update `analyzeMaintenanceRequestSimilarity()` in `aiService.js` (0.5 → 0.35)

### Step 3: Add Issue Continuity Analysis

- [ ] Create `analyzeIssueContinuity()` function
- [ ] Implement conversation history analysis
- [ ] Integrate into `executeAction()` as Layer -1

### Step 4: Enhance Duplicate Detection Prompts

- [ ] Update `analyzeDuplicateWithAI()` prompt
- [ ] Update `checkSemanticSimilarity()` prompt
- [ ] Add "assume duplicate" philosophy to all prompts

### Step 5: Update executeAction() Flow

- [ ] Add Layer -1 (issue continuity)
- [ ] Update all confidence thresholds
- [ ] Enhance logging for better tracking

### Step 6: Test Enhanced System

- [ ] Run test scenarios
- [ ] Measure duplicate prevention rate
- [ ] Track false positives/negatives
- [ ] Adjust thresholds if needed

### Step 7: Document Changes

- [ ] Update README with new deduplication strategy
- [ ] Create test suite documentation
- [ ] Add monitoring dashboard metrics

## Expected Outcomes

### Quantitative Improvements

1. **Duplicate Prevention Rate**: Increase from ~70% to ~90%
2. **False Positive Rate**: Maintain below 10%
3. **False Negative Rate**: Reduce from ~30% to ~10%
4. **Manager Notifications**: Reduce duplicate notifications by 50%+

### Qualitative Improvements

1. **Tenant Experience**: Fewer "duplicate request" clarifications
2. **Manager Experience**: Cleaner request queue, less noise
3. **System Reliability**: More consistent duplicate detection
4. **AI Accuracy**: Better understanding of issue continuity

## Risk Mitigation

### Potential Risks

1. **Over-aggressive Deduplication**: May incorrectly merge different issues
   - **Mitigation**: Monitor false positive rate, adjust thresholds

2. **Increased AI Costs**: More AI calls for issue continuity analysis
   - **Mitigation**: Cache results, optimize prompts

3. **Complexity**: More layers to maintain
   - **Mitigation**: Clear documentation, comprehensive logging

### Rollback Plan

If issues arise:

1. Revert confidence thresholds to previous values
2. Disable Layer -1 (issue continuity)
3. Monitor system behavior
4. Gradually re-enable features with adjusted thresholds

## Success Criteria

1. Duplicate prevention rate ≥ 90%
2. False positive rate ≤ 10%
3. False negative rate ≤ 10%
4. Manager duplicate notifications reduced by 50%+
5. Tenant satisfaction maintained or improved
6. System performance not degraded (<2 second response time)

## Timeline

- **Phase 1**: 2-3 hours
- **Phase 2**: 3-4 hours
- **Phase 3**: 2-3 hours
- **Phase 4**: 4-5 hours
- **Phase 5**: 2-3 hours

**Total**: 13-18 hours of development time

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Test each phase before proceeding
4. Monitor metrics after deployment
5. Iterate based on real-world data
