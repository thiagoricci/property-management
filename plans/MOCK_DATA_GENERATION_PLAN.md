# Mock Data Generation Plan

## Overview

Generate realistic test data with 3 tenants, each having 1 conversation thread with 10 messages.

## Database Structure Understanding

Based on migration 006 (conversation threading):

- **conversation_threads**: Groups related messages by topic/subject
- **messages**: Individual message/response pairs (each row = 1 user message + 1 AI response)
- **properties**: Property information
- **tenants**: Tenant information linked to properties

## Data Requirements

### 1. Properties (3 properties)

Each tenant should be associated with a different property:

- Property 1: Downtown apartment
- Property 2: Suburban house
- Property 3: Urban studio

### 2. Tenants (3 tenants)

- Tenant 1: Alice Johnson (Downtown apartment)
- Tenant 2: Bob Martinez (Suburban house)
- Tenant 3: Carol Chen (Urban studio)

### 3. Conversation Threads (3 threads, one per tenant)

Each thread represents a single conversation topic:

- Thread 1: Maintenance issue (leaking faucet)
- Thread 2: General inquiry (amenities access)
- Thread 3: Emergency situation (power outage)

### 4. Messages (10 messages per thread = 30 total messages)

Each message row contains:

- `message_type`: 'user_message'
- `message`: Tenant's question/statement
- `response`: AI's response (with JSON actions stripped for display)
- `ai_actions`: JSONB field with any extracted actions
- `timestamp`: Sequential timestamps

## Conversation Scenarios

### Thread 1: Leaking Faucet (Alice Johnson)

**Topic**: Maintenance request - urgent issue

**Messages**:

1. User: "Hi, the faucet in my bathroom is leaking badly. Water is dripping constantly."
2. AI: Acknowledge and ask for details
3. User: "It's the cold water tap in the master bathroom sink. Started about 2 hours ago."
4. AI: Create maintenance ticket, confirm details
5. User: "Should I turn off the water supply to the sink?"
6. AI: Advise on temporary fix
7. User: "I did that. How soon can someone come?"
8. AI: Provide timeline and next steps
9. User: "Thanks, that helps. Will I get updates?"
10. AI: Confirm notification process

### Thread 2: Pool Access (Bob Martinez)

**Topic**: General inquiry - amenities

**Messages**:

1. User: "What are the pool hours? I want to go swimming tonight."
2. AI: Provide pool hours information
3. User: "Can I bring guests to the pool?"
4. AI: Explain guest policy
5. User: "Is there a limit on how many guests?"
6. AI: Clarify guest limits
7. User: "Do I need to sign them in somewhere?"
8. AI: Explain check-in process
9. User: "Perfect, thanks for the info!"
10. AI: Offer additional assistance

### Thread 3: Power Outage (Carol Chen)

**Topic**: Emergency - no power

**Messages**:

1. User: "Emergency! The power just went out in my unit. I can't see anything."
2. AI: Immediate emergency response, safety guidance
3. User: "I'm using my phone flashlight. Should I call the building manager?"
4. AI: Confirm escalation, provide next steps
5. User: "Is this affecting other units too?"
6. AI: Check if it's building-wide or isolated
7. User: "My neighbor says they have power. It's just my unit."
8. AI: Advise on circuit breaker check
9. User: "The breaker was tripped. I reset it and power is back!"
10. AI: Confirm resolution, document incident

## Implementation Approach

### Script Structure

Create `scripts/seed-mock-conversations.js` with:

1. **Database Connection**: Use existing connection pattern
2. **Data Generation Functions**:
   - `createProperties()` - Insert 3 properties
   - `createTenants(properties)` - Insert 3 tenants
   - `createConversationThreads(tenants, properties)` - Insert 3 threads
   - `createMessages(threads)` - Insert 10 messages per thread

3. **Message Templates**:
   - Pre-defined conversation flows for each scenario
   - Realistic AI responses
   - Proper `ai_actions` JSON where applicable
   - Sequential timestamps (1-2 hours apart)

4. **Error Handling**:
   - Transaction rollback on failure
   - Clear error messages
   - Success confirmation output

## Key Considerations

### Message Type Handling

- All rows in `messages` table will have `message_type = 'user_message'`
- The `response` field contains AI's response
- This follows the new threading structure from migration 006

### AI Actions

- Thread 1 (maintenance): Include `maintenance_request` action in message 4
- Thread 3 (emergency): Include `alert_manager` action in message 2
- Other messages: No actions or minimal actions

### Timestamps

- Start each thread at different times (spread over a few days)
- Messages within each thread: 15-30 minutes apart
- Realistic conversation flow

### Channel

- All conversations: Use 'sms' channel for consistency
- Could vary in future (email, whatsapp)

## Validation Criteria

After running the script, verify:

1. **Properties**: 3 properties exist
2. **Tenants**: 3 tenants exist, each linked to a property
3. **Conversation Threads**: 3 threads exist, each linked to tenant and property
4. **Messages**: 30 messages exist (10 per thread)
5. **Thread-Message Links**: All messages have valid `thread_id`
6. **Timestamps**: Sequential and realistic
7. **AI Actions**: Proper JSON structure where applicable

## Files to Create

1. `scripts/seed-mock-conversations.js` - Main seed script
2. `plans/MOCK_DATA_GENERATION_COMPLETE.md` - Documentation after completion

## Execution Steps

1. Create the seed script
2. Run: `node scripts/seed-mock-conversations.js`
3. Verify data in database:
   ```sql
   SELECT COUNT(*) FROM properties; -- Should be 3+
   SELECT COUNT(*) FROM tenants; -- Should be 3+
   SELECT COUNT(*) FROM conversation_threads; -- Should be 3
   SELECT COUNT(*) FROM messages; -- Should be 30
   SELECT thread_id, COUNT(*) FROM messages GROUP BY thread_id; -- Should show 10 per thread
   ```
4. Test in dashboard to ensure data displays correctly

## Success Metrics

- Script executes without errors
- All 30 messages are created
- Dashboard displays conversations correctly
- Thread grouping works as expected
- Message flow appears natural and realistic
