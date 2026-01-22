# Test Data Documentation

## Overview

This document describes the test data created for the AI Property Management System. The test data is designed to simulate realistic tenant interactions and maintenance requests for testing purposes.

## Data Structure

### Summary

- **3 Tenants** with complete profiles
- **3 Properties** with detailed information
- **3 Conversation Threads** (one per tenant)
- **30 Messages** (10 messages per thread)
- **6 Maintenance Requests** (2 per thread: 1 emergency, 1 normal)

### Tenant 1: John Smith

**Property**: 123 Main Street
**Phone**: +15551234567
**Email**: john.smith@example.com

**Conversation Thread**: "General inquiries and maintenance issues"

- **Status**: resolved
- **Channel**: SMS
- **Messages**: 10

**Maintenance Requests**:

1. 🚨 **Emergency**: "Burst pipe flooding bathroom - immediate attention required"
   - Priority: emergency
   - Status: resolved
   - Triggered by message 3

2. 📋 **Normal**: "Kitchen faucet dripping"
   - Priority: normal
   - Status: open
   - Triggered by message 6

**Conversation Flow**:

1. WiFi password inquiry
2. Trash pickup day question
3. **Emergency**: Burst pipe report
4. Confirmation of shut-off valve
5. Plumber completion update
6. **Normal**: Kitchen faucet dripping
7. Drip details (constant, 1 drop/sec)
8. Lease agreement copy request
9. Thank you
10. Closing

---

### Tenant 2: Sarah Johnson

**Property**: 456 Oak Avenue
**Phone**: +15552345678
**Email**: sarah.johnson@example.com

**Conversation Thread**: "Property questions and maintenance requests"

- **Status**: resolved
- **Channel**: SMS
- **Messages**: 10

**Maintenance Requests**:

1. 🚨 **Emergency**: "Gas leak detected in kitchen - immediate evacuation required"
   - Priority: emergency
   - Status: resolved
   - Triggered by message 4

2. 📋 **Normal**: "Bedroom light fixture not working"
   - Priority: normal
   - Status: open
   - Triggered by message 7

**Conversation Flow**:

1. Welcome and initial questions
2. Laundry facilities location
3. Pool heating inquiry
4. **Emergency**: Gas leak report
5. Evacuation confirmation
6. All-clear from gas company
7. **Normal**: Bedroom light fixture issue
8. Light fixture details (not turning on)
9. Pet policy question (cats)
10. Pet application form request

---

### Tenant 3: Michael Davis

**Property**: 789 Pine Road
**Phone**: +15553456789
**Email**: michael.davis@example.com

**Conversation Thread**: "Lease questions and maintenance"

- **Status**: resolved
- **Channel**: SMS
- **Messages**: 10

**Maintenance Requests**:

1. 🚨 **Emergency**: "No heat in apartment during winter - urgent repair needed"
   - Priority: emergency
   - Status: resolved
   - Triggered by message 4

2. 📋 **Normal**: "Garbage disposal jammed"
   - Priority: normal
   - Status: open
   - Triggered by message 8

**Conversation Flow**:

1. Lease question
2. Subletting inquiry
3. Manager referral
4. **Emergency**: No heat report
5. Thermostat details (set to 72, furnace not running)
6. Technician on-site
7. Heat restored confirmation
8. **Normal**: Garbage disposal issue
9. Reset button attempted (didn't work)
10. Thank you and closing

---

## Database Schema

### Tables Populated

1. **properties** - 3 records
   - Address, owner info, amenities, rules

2. **tenants** - 3 records
   - Name, phone, email, lease terms, move-in date

3. **conversation_threads** - 3 records
   - Subject, status, channel, timestamps

4. **messages** - 30 records
   - Thread ID, tenant ID, message, response, timestamp

5. **maintenance_requests** - 6 records
   - Property ID, tenant ID, message ID, issue description, priority, status

## Usage

### Running the Seed Script

```bash
# Create test data
node scripts/seed-test-data.js

# Verify test data
node scripts/verify-test-data.js
```

### Clearing Test Data

The seed script automatically clears existing test data before creating new data. It identifies test data by:

- Phone numbers starting with `+1555`
- Property addresses: "123 Main Street", "456 Oak Avenue", "789 Pine Road"

### Manual Data Cleanup

If you need to manually remove test data:

```sql
DELETE FROM maintenance_requests WHERE tenant_id IN (
  SELECT id FROM tenants WHERE phone LIKE '+1555%'
);

DELETE FROM messages WHERE thread_id IN (
  SELECT id FROM conversation_threads WHERE tenant_id IN (
    SELECT id FROM tenants WHERE phone LIKE '+1555%'
  )
);

DELETE FROM conversation_threads WHERE tenant_id IN (
  SELECT id FROM tenants WHERE phone LIKE '+1555%'
);

DELETE FROM tenants WHERE phone LIKE '+1555%';

DELETE FROM properties WHERE address IN (
  '123 Main Street', '456 Oak Avenue', '789 Pine Road'
);
```

## Test Scenarios

### Emergency Detection Testing

The test data includes 3 emergency scenarios:

1. **Burst pipe** - Water flooding, immediate plumber dispatch
2. **Gas leak** - Evacuation protocol, gas company coordination
3. **No heat** - Winter emergency, heating technician dispatch

These scenarios test:

- Emergency keyword detection
- Immediate manager notification
- Priority-based routing
- Escalation procedures

### Normal Maintenance Testing

The test data includes 3 normal priority scenarios:

1. **Kitchen faucet dripping** - Constant drip, scheduled maintenance
2. **Bedroom light fixture** - Not working, technician inspection
3. **Garbage disposal** - Jammed, repair scheduling

These scenarios test:

- Normal priority classification
- Maintenance request creation
- Status tracking
- Technician coordination

### Conversation Flow Testing

Each conversation thread includes:

- General inquiries (WiFi, trash pickup, pool, etc.)
- Property questions (laundry, amenities, pet policy)
- Lease questions (subletting, copy requests)
- Multiple interactions (5-10 exchanges)

These scenarios test:

- AI response generation
- Context awareness
- Conversation history tracking
- Multi-turn conversations

## Integration Testing

### Dashboard Testing

Use this test data to verify:

- **Properties page** - Shows 3 properties with details
- **Tenants page** - Shows 3 tenants with contact info
- **Conversations page** - Shows 3 threads with message counts
- **Conversation detail** - Shows full 10-message chat history
- **Maintenance page** - Shows 6 requests with priority badges
- **Maintenance detail** - Shows related conversation and status

### API Testing

Test endpoints with this data:

- `GET /api/properties` - List all properties
- `GET /api/tenants` - List all tenants
- `GET /api/conversations` - List all conversation threads
- `GET /api/conversations/:id` - Get thread details with messages
- `GET /api/maintenance` - List all maintenance requests
- `GET /api/maintenance/:id` - Get maintenance request details

### AI Testing

Test AI responses with:

- Emergency detection keywords
- Normal maintenance classification
- Property-specific information
- Lease term queries
- General property questions

## Data Relationships

```
Property (1) ←→ (N) Tenant
    ↓
    ↓
Conversation Thread (1) ←→ (N) Message
    ↓
    ↓
Maintenance Request (1) ←→ (1) Message
```

Each maintenance request is linked to a specific message within a conversation thread, enabling traceability from issue to resolution.

## Maintenance Request Status

### Emergency Requests (3)

- All marked as `resolved`
- Simulate completed emergency repairs
- Test resolved status handling in dashboard

### Normal Requests (3)

- All marked as `open`
- Simulate pending maintenance
- Test open status handling and workflow

## Timestamps

Messages are timestamped with 2-hour intervals, simulating realistic conversation flow over a 20-hour period. This allows testing of:

- Chronological ordering
- Conversation history display
- Time-based queries
- Activity tracking

## Customization

To modify test data, edit [`scripts/seed-test-data.js`](scripts/seed-test-data.js):

```javascript
const tenantsData = [
  {
    name: "Your Tenant Name",
    phone: "+1555XXXXXXX",
    email: "tenant@example.com",
    property: {
      /* property details */
    },
    thread: {
      subject: "Thread subject",
      channel: "sms",
      messages: [
        {
          user: "Tenant message",
          ai: "AI response",
          emergency: true, // optional
          emergency_description: "Emergency description", // optional
          normal: true, // optional
          normal_description: "Normal description", // optional
        },
      ],
    },
  },
];
```

## Notes

- All test data uses phone numbers starting with `+1555` for easy identification
- Properties use specific addresses for easy cleanup
- Emergency requests are marked as resolved to simulate completed repairs
- Normal requests are marked as open to simulate pending work
- All conversation threads are marked as resolved
- Messages include realistic AI responses for testing conversation flow

## Related Scripts

- [`scripts/seed-test-data.js`](scripts/seed-test-data.js) - Main seed script
- [`scripts/verify-test-data.js`](scripts/verify-test-data.js) - Verification script
- [`scripts/seed-mock-data.js`](scripts/seed-mock-data.js) - Alternative mock data (legacy)
- [`scripts/seed-mock-conversations.js`](scripts/seed-mock-conversations.js) - Conversation-only seed (legacy)

## Support

For issues or questions about test data:

1. Run verification script: `node scripts/verify-test-data.js`
2. Check database connection in `.env`
3. Review logs from seed script execution
4. Ensure PostgreSQL is running

---

**Last Updated**: 2026-01-21
**Version**: 1.0
