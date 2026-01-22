# Mock Data Generation - COMPLETE

**Date**: 2026-01-21
**Status**: ✅ COMPLETED

## Summary

Successfully generated comprehensive mock data for testing the AI Property Manager application with realistic conversation scenarios.

## What Was Created

### 1. Properties (3 new properties)

| ID  | Address                                               | Owner         | Type               |
| --- | ----------------------------------------------------- | ------------- | ------------------ |
| 3   | 123 Main Street, Apt 4B, San Francisco, CA 94102      | John Smith    | Downtown apartment |
| 4   | 456 Oak Lane, Pleasanton, CA 94588                    | Sarah Johnson | Suburban house     |
| 5   | 789 Market Street, Studio 12, San Francisco, CA 94103 | Michael Chen  | Urban studio       |

Each property includes:

- Owner contact information (name, email, phone)
- Amenities (WiFi, parking, laundry, gym, pool, etc.)
- Rules (quiet hours, guest policy, pet policy, smoking policy)
- FAQ (property-specific information for AI context)

### 2. Tenants (3 new tenants)

| ID  | Name          | Phone       | Property           | Lease        |
| --- | ------------- | ----------- | ------------------ | ------------ |
| 8   | Alice Johnson | +1-555-0201 | Downtown apartment | $2,800/month |
| 9   | Bob Martinez  | +1-555-0202 | Suburban house     | $3,500/month |
| 10  | Carol Chen    | +1-555-0203 | Urban studio       | $2,200/month |

Each tenant includes:

- Property association
- Contact information (phone, email)
- Lease terms (rent amount, dates, security deposit)

### 3. Conversation Threads (3 threads)

| ID  | Subject                                       | Tenant        | Status   | Channel |
| --- | --------------------------------------------- | ------------- | -------- | ------- |
| 31  | Leaking bathroom faucet - maintenance request | Alice Johnson | resolved | sms     |
| 32  | Pool hours and guest policy inquiry           | Bob Martinez  | resolved | sms     |
| 33  | Power outage emergency - resolved             | Carol Chen    | resolved | sms     |

Each thread includes:

- Tenant and property association
- Subject line describing conversation topic
- Status tracking (active/resolved/escalated)
- Channel (sms)
- Timestamps (created_at, last_activity_at)
- Summary of conversation

### 4. Messages (30 messages total, 10 per thread)

**Thread 31 - Leaking Faucet (Alice Johnson)**:

- Maintenance request scenario
- 10 realistic message exchanges
- AI creates maintenance request with priority "urgent"
- Includes advice on temporary fixes and timeline information

**Thread 32 - Pool Access (Bob Martinez)**:

- General inquiry scenario
- 10 realistic message exchanges
- Covers pool hours, guest policy, sign-in requirements
- Includes pool rules and amenities information

**Thread 33 - Power Outage (Carol Chen)**:

- Emergency scenario
- 10 realistic message exchanges
- AI sends immediate emergency alert
- Includes troubleshooting guidance and electrical inspection request
- Faster response times (10-20 minutes apart vs 15-35 minutes)

Each message includes:

- Thread association
- Tenant association
- Channel (sms)
- User message content
- AI response (realistic, helpful)
- AI actions (JSONB with maintenance requests or emergency alerts where applicable)
- Message type (user_message)
- Sequential timestamps

## Conversation Scenarios

### Scenario 1: Maintenance Request (Leaking Faucet)

**Flow**:

1. Tenant reports issue
2. AI acknowledges and asks for details
3. Tenant provides specifics
4. AI creates maintenance request (urgent priority)
5. Tenant asks about temporary fix
6. AI provides guidance
7. Tenant asks about timeline
8. AI provides timeline and next steps
9. Tenant asks about updates
10. AI confirms notification process
11. (Additional messages about portal access)

**Key Features**:

- Maintenance request action created with proper JSON structure
- Priority classification (urgent)
- Helpful guidance on temporary fixes
- Clear communication about process

### Scenario 2: General Inquiry (Pool Access)

**Flow**:

1. Tenant asks about pool hours
2. AI provides hours information
3. Tenant asks about guests
4. AI explains guest policy
5. Tenant asks about guest limits
6. AI clarifies limits
7. Tenant asks about sign-in
8. AI explains process
9. Tenant asks about rules
10. AI provides rules
11. (Additional messages about amenities, food, music)

**Key Features**:

- Comprehensive FAQ-style responses
- Policy information from property rules
- Clear explanations of procedures
- No maintenance actions needed

### Scenario 3: Emergency (Power Outage)

**Flow**:

1. Tenant reports emergency
2. AI sends immediate alert (emergency action)
3. AI provides safety guidance
4. AI troubleshoots issue
5. Tenant checks circuit breaker
6. AI guides reset procedure
7. Power restored
8. AI creates electrical inspection request
9. AI provides safety recommendations
10. AI confirms follow-up

**Key Features**:

- Immediate emergency alert action
- Fast response times (emergency priority)
- Troubleshooting guidance
- Follow-up maintenance request
- Safety-focused communication

## Technical Implementation

### Script Features

1. **Database Transactions**:
   - All operations wrapped in transaction
   - Automatic rollback on error
   - Data integrity guaranteed

2. **Timestamp Management**:
   - Sequential timestamps for realistic conversation flow
   - Different time intervals per scenario:
     - Maintenance: 20-35 minutes apart
     - Inquiry: 15-25 minutes apart
     - Emergency: 10-20 minutes apart

3. **AI Actions**:
   - Proper JSONB structure
   - Maintenance request actions with priority and description
   - Emergency alert actions with urgency and reason
   - Stored in `ai_actions` column

4. **Thread Management**:
   - Proper thread-message linking
   - Last activity timestamps updated
   - Status tracking (resolved for all threads)
   - Summary field populated

5. **Error Handling**:
   - Try-catch blocks throughout
   - Transaction rollback on failure
   - Clear error messages
   - Graceful exit codes

## Verification Results

### Database Counts

- ✅ Properties: 4 total (3 new + 1 existing)
- ✅ Tenants: 4 total (3 new + 1 existing)
- ✅ Conversation Threads: 3 (all new)
- ✅ Messages: 30 (all new)

### Message Distribution

- ✅ Thread 31: 10 messages
- ✅ Thread 32: 10 messages
- ✅ Thread 33: 10 messages

### Data Quality

- ✅ All messages have valid thread_id
- ✅ All messages have valid tenant_id
- ✅ All threads have valid tenant_id and property_id
- ✅ Timestamps are sequential and realistic
- ✅ AI actions properly formatted as JSON
- ✅ Message types set correctly to 'user_message'

## Usage

### Running the Script

```bash
node scripts/seed-mock-conversations.js
```

### Viewing Data in Dashboard

1. Log into dashboard at http://localhost:3001
2. Navigate to Conversations page
3. View the 3 new conversation threads
4. Click on any thread to see full message history
5. Messages display in chat-style interface

### Testing Features

With this mock data, you can test:

1. **Conversation List View**:
   - See all 3 threads
   - Filter by tenant name or message content
   - View thread status badges
   - See channel icons (SMS)

2. **Conversation Detail View**:
   - Chat-style message display
   - User messages on right, AI responses on left
   - Timestamps for each message
   - AI actions displayed where applicable
   - Related maintenance requests shown

3. **Maintenance Requests**:
   - View maintenance request from Thread 31 (leaking faucet)
   - View maintenance request from Thread 33 (electrical inspection)
   - Test status updates (open → in progress → resolved)
   - Add manager notes

4. **Analytics**:
   - View conversation statistics
   - Filter by date range
   - See message counts per tenant

## Files Created

1. **`scripts/seed-mock-conversations.js`**
   - Main seed script (300+ lines)
   - Creates 3 properties, 3 tenants, 3 threads, 30 messages
   - Includes comprehensive error handling
   - Provides detailed verification output

2. **`plans/MOCK_DATA_GENERATION_PLAN.md`**
   - Detailed planning document
   - Database structure analysis
   - Conversation scenarios
   - Implementation approach
   - Validation criteria

3. **`plans/MOCK_DATA_GENERATION_COMPLETE.md`** (this file)
   - Completion documentation
   - Summary of created data
   - Technical implementation details
   - Usage instructions

## Success Metrics

- ✅ Script executes without errors
- ✅ All 30 messages created successfully
- ✅ Data integrity verified in database
- ✅ Realistic conversation flows
- ✅ Proper threading structure
- ✅ AI actions correctly formatted
- ✅ Timestamps sequential and appropriate
- ✅ Ready for dashboard testing

## Next Steps

1. **Test in Dashboard**:
   - Verify conversations display correctly
   - Test message detail view
   - Verify thread grouping works
   - Test search and filtering

2. **Add More Scenarios** (if needed):
   - Email conversations
   - WhatsApp conversations
   - Multi-thread conversations per tenant
   - Different maintenance priorities

3. **Performance Testing**:
   - Test with larger datasets
   - Verify pagination works
   - Check query performance
   - Monitor dashboard load times

## Notes

- All mock data uses realistic phone numbers in format +1-555-XXXX
- Email addresses follow pattern: firstname.lastname@example.com
- Addresses are realistic but fictional
- All timestamps are in the past (1-3 days ago)
- Conversations are marked as 'resolved' for clean testing state
- Script can be run multiple times (uses ON CONFLICT DO NOTHING)

## Conclusion

Mock data generation completed successfully. The application now has realistic test data covering three different conversation scenarios:

1. Maintenance request (urgent priority)
2. General inquiry (FAQ-style)
3. Emergency situation (immediate response)

This data provides comprehensive test coverage for the conversation threading system and dashboard functionality.
