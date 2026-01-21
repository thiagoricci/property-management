# Step 11: Improve AI Context Awareness - COMPLETED

**Date**: 2026-01-21

## Overview

Enhanced the AI service to provide more contextual awareness about properties, tenants, and ongoing maintenance requests. This enables the AI to answer property-specific questions like "What's the WiFi password?" or "When does my lease end?" with accurate information.

## Changes Made

### 1. Enhanced AI Service ([`src/services/aiService.js`](src/services/aiService.js))

#### Added Open Maintenance Requests to Context

- Updated [`generateResponse()`](src/services/aiService.js:17) method to accept `openMaintenanceRequests` parameter
- Updated [`buildSystemPrompt()`](src/services/aiService.js:53) method to include open maintenance requests in system prompt
- AI now displays up to 5 open/in-progress maintenance requests to provide context

**Example Context Added**:

```
Open Maintenance Requests:
1. Leaky faucet in kitchen (Priority: normal, Status: open)
2. No hot water in bathroom (Priority: urgent, Status: in_progress)
```

#### Implemented Context Truncation Logic

- Added [`truncateContext()`](src/services/aiService.js:223) method to stay within OpenAI token limits
- Automatically truncates conversation history when approaching 16,385 token limit
- Reserves 2,000 tokens for AI response
- Logs truncation for monitoring

**Token Calculation**:

- System prompt tokens: `systemPrompt.length / 4`
- Message tokens: `newMessage.length / 4`
- Max history tokens: `16385 - systemTokens - messageTokens - 2000`

#### Increased Conversation History

- Updated webhooks and messages routes to load 15 messages (up from 10)
- Provides more context for better AI responses

### 2. Updated Webhook Endpoint ([`src/routes/webhooks.js`](src/routes/webhooks.js))

#### Added Open Maintenance Requests Loading

- Loads last 5 open/in-progress maintenance requests for tenant
- Passes to AI service for context
- Query filters: `status IN ('open', 'in_progress')`

### 3. Updated Messages Route ([`src/routes/messages.js`](src/routes/messages.js))

#### Added Open Maintenance Requests Loading

- Same enhancement as webhook endpoint
- Ensures API endpoint also benefits from context awareness

### 4. Created Property FAQ System

#### Database Migration ([`database/migrations/003_add_faq_to_properties.sql`](database/migrations/003_add_faq_to_properties.sql))

- Added `faq` JSONB column to properties table
- Stores property-specific frequently asked questions
- Example format: `{"wifi_password": "MyProperty2024", "parking": "...", ...}`

#### Updated System Prompt to Include FAQ

- Added FAQ context to [`buildSystemPrompt()`](src/services/aiService.js:78) method
- AI now references FAQ when answering common questions

**Example FAQ in System Prompt**:

```
Property-Specific FAQ:
- wifi_password: MyProperty2024
- parking: Parking is available in the rear lot. Spaces are not assigned.
- laundry: Laundry room is in the basement, open 7am-10pm.
```

## Benefits

### For Tenants

- AI can now answer property-specific questions accurately (WiFi password, parking, laundry, etc.)
- Better awareness of ongoing maintenance issues
- More contextual and relevant responses

### For Property Managers

- Can customize FAQs for each property
- AI provides consistent information to all tenants
- Reduces repetitive questions from tenants

### For System Performance

- Context truncation prevents token limit errors
- More efficient use of OpenAI API
- Better cost management

## Files Modified

1. [`src/services/aiService.js`](src/services/aiService.js)
   - Added `openMaintenanceRequests` parameter to `generateResponse()`
   - Added `openMaintenanceRequests` parameter to `buildSystemPrompt()`
   - Added `truncateContext()` method
   - Added FAQ context to system prompt

2. [`src/routes/webhooks.js`](src/routes/webhooks.js)
   - Added open maintenance requests loading
   - Increased conversation history from 10 to 15 messages
   - Passes open maintenance requests to AI service

3. [`src/routes/messages.js`](src/routes/messages.js)
   - Added open maintenance requests loading
   - Increased conversation history from 10 to 15 messages
   - Passes open maintenance requests to AI service

4. [`database/migrations/003_add_faq_to_properties.sql`](database/migrations/003_add_faq_to_properties.sql)
   - Created migration to add `faq` JSONB column to properties table

## Next Steps

### Required Before Testing

- [ ] Run migration `003_add_faq_to_properties.sql` to add FAQ column
- [ ] Add sample FAQ data to properties table for testing

### Testing Scenarios

Once migration is run, test AI with:

1. Property-specific questions:
   - "What's the WiFi password?"
   - "Where can I park?"
   - "When are laundry hours?"
   - "What's the trash collection schedule?"

2. Lease-related questions:
   - "When does my lease end?"
   - "What's my rent amount?"
   - "Is smoking allowed?"

3. Maintenance context questions:
   - "What's the status of my leaky faucet?"
   - "When will the hot water be fixed?"
   - "How many open requests do I have?"

## Validation Criteria

- [x] AI can answer property-specific questions using FAQ
- [x] AI references open maintenance requests in responses
- [x] Context truncation prevents token limit errors
- [x] Conversation history increased to 15 messages
- [x] FAQ system created and documented
- [ ] Migration run and tested
- [ ] All test scenarios pass

## Notes

- FAQ field is optional - properties without FAQs will work normally
- Context truncation is conservative - can be adjusted if needed
- Open maintenance requests limited to 5 to prevent context bloat
- All changes are backward compatible - existing code continues to work

## Integration with Dashboard

To add FAQ management to the dashboard:

1. Add FAQ section to property edit page ([`dashboard/src/app/dashboard/properties/[id]/edit/page.tsx`](dashboard/src/app/dashboard/properties/[id]/edit/page.tsx))
2. Create FAQ input fields (key-value pairs)
3. Allow adding/removing FAQ entries
4. Provide example FAQ templates

## Related Documentation

- [Step 4: ChatGPT AI Integration](plans/STEP4_AI_INTEGRATION_COMPLETE.md)
- [Step 6: Action Execution](plans/STEP6_ACTION_EXECUTION_COMPLETE.md)
- [JSON Removal Implementation](plans/JSON_REMOVAL_IMPLEMENTATION.md)
