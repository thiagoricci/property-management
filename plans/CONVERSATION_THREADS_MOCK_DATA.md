# Conversation Threads Mock Data

## Overview

This document describes the mock conversation threads created for testing the AI Property Management System.

**Created**: 2026-01-21
**Script**: `scripts/seed-conversation-threads.js`
**Verification**: `scripts/verify-conversation-threads.js`

## Data Summary

- **Properties**: 1
- **Tenants**: 3
- **Total Messages**: 30
- **Messages per Tenant**: 10 each
- **Maintenance Requests**: 3
- **Priorities**: Emergency, Urgent, Normal

## Tenants

### 1. Alice Johnson

- **ID**: 5
- **Phone**: +1-555-0202
- **Email**: alice.johnson@example.com
- **Issue**: Burst pipe causing flooding (Emergency)
- **Messages**: 10
- **Priority**: Emergency

### 2. Bob Martinez

- **ID**: 6
- **Phone**: +1-555-0203
- **Email**: bob.martinez@example.com
- **Issue**: Heating system not working (Urgent)
- **Messages**: 10
- **Priority**: Urgent

### 3. Carol Williams

- **ID**: 7
- **Phone**: +1-555-0204
- **Email**: carol.williams@example.com
- **Issue**: Leaky kitchen faucet (Normal)
- **Messages**: 10
- **Priority**: Normal

## Conversation Threads

### Alice Johnson - Emergency (Burst Pipe)

**Priority**: Emergency
**Status**: Resolved
**Messages**: 10 (5 user + 5 AI responses)

**Conversation Flow**:

1. User: "HELP! There's water everywhere! A pipe burst in bathroom!"
   - AI: Emergency response, immediate action, turn off valve
   - Action: Maintenance request (emergency) + Alert manager

2. User: "I found the valve but it's stuck! What do I do?"
   - AI: Alternative solutions, contact plumber

3. User: "Okay, I turned it off but there's still water everywhere!"
   - AI: Containment advice, manager alerted

4. User: "The manager is here now, thank you!"
   - AI: Confirmation, next steps

5. User: "Will my belongings be covered?"
   - AI: Insurance policy guidance

6. User: "I don't have renter's insurance. What should I do?"
   - AI: Documentation advice, future recommendation

7. User: "The plumber fixed the pipe! Water is back on."
   - AI: Confirmation, check for damage

8. User: "There's some water damage to the floor, but not too bad."
   - AI: Document damage, arrange repairs

9. User: "No, that's all for now. Thanks for the quick help!"
   - AI: Closing, stay safe

10. User: "One more thing - should I keep the area ventilated?"
    - AI: Ventilation advice, mold prevention

**Key Features**:

- Emergency detection and immediate escalation
- Progressive problem resolution
- Insurance guidance
- Damage documentation
- Safety advice (ventilation)

### Bob Martinez - Urgent (No Heat)

**Priority**: Urgent
**Status**: Resolved
**Messages**: 10 (5 user + 5 AI responses)

**Conversation Flow**:

1. User: "The heating isn't working and it's freezing in here! It's been off since last night."
   - AI: Urgent request created, HVAC technician contact
   - Action: Maintenance request (urgent)

2. User: "It's about 55 degrees inside. I'm really cold."
   - AI: Priority confirmation, space heater suggestion

3. User: "I have a small space heater. Can I use it?"
   - AI: Safety guidelines for space heaters

4. User: "Okay, I have it running. What else should I do?"
   - AI: Heat retention tips

5. User: "How long until the technician can come?"
   - AI: Timeline estimate, accommodation offer

6. User: "It's getting colder. Now about 52 degrees."
   - AI: Temperature monitoring, health check

7. User: "I'm okay, just cold. The technician just arrived!"
   - AI: Confirmation, status tracking

8. User: "They're working on it now. Said it's a thermostat issue."
   - AI: Issue identification, ETA

9. User: "Heat is back on! Thank you so much for the help."
   - AI: Resolution confirmation, gradual warm-up advice

10. User: "Yes, it's getting warmer. Thanks again!"
    - AI: Closing, follow-up promise

**Key Features**:

- Temperature monitoring and health checks
- Safety guidelines for temporary heating
- Timeline communication
- Progressive status updates
- Health and safety concern

### Carol Williams - Normal (Leaky Faucet)

**Priority**: Normal
**Status**: Resolved
**Messages**: 10 (5 user + 5 AI responses)

**Conversation Flow**:

1. User: "The kitchen faucet has been dripping constantly for a few days. It's annoying and wasting water."
   - AI: Maintenance request created, plumber scheduling
   - Action: Maintenance request (normal)

2. User: "I tried tightening it but it's still dripping."
   - AI: Diagnosis (washer/O-ring), scheduling

3. User: "I'm available Tuesday afternoon if that works."
   - AI: Appointment confirmation, preparation tips

4. User: "Great, thanks. Should I do anything before they arrive?"
   - AI: Preparation checklist

5. User: "Will do. Is this going to cost me anything?"
   - AI: Cost clarification (covered under maintenance)

6. User: "The plumber came and fixed it! Thanks!"
   - AI: Resolution confirmation, verification

7. User: "Yes, it's working perfectly now. No more drips!"
   - AI: Success acknowledgment, additional needs

8. User: "No, that's all. Thanks for the quick scheduling!"
   - AI: Closing, future support

9. User: "Actually, one more question - what about the bathroom sink? It drips a little too."
   - AI: Additional issue handling, scheduling options

10. User: "Let's do it separately, it's not too bad."
    - AI: Future scheduling, minor issue handling

**Key Features**:

- Flexible scheduling around tenant availability
- Cost transparency
- Preparation guidance
- Additional issue identification
- Prioritization (separate scheduling for minor issues)

## Maintenance Requests

### 1. Emergency - Burst Pipe

- **Tenant**: Alice Johnson
- **Property**: 123 Main Street, Apt 4B
- **Issue**: Burst pipe causing flooding in bathroom
- **Priority**: Emergency
- **Status**: Resolved
- **Notes**: Emergency - Immediate action required. Plumber fixed the pipe. Floor has water damage that needs repair.

### 2. Urgent - No Heat

- **Tenant**: Bob Martinez
- **Property**: 123 Main Street, Apt 4B
- **Issue**: Heating system not working - apartment is freezing
- **Priority**: Urgent
- **Status**: Resolved
- **Notes**: Urgent - Thermostat issue. HVAC technician repaired thermostat. Heat restored.

### 3. Normal - Leaky Faucet

- **Tenant**: Carol Williams
- **Property**: 123 Main Street, Apt 4B
- **Issue**: Leaky kitchen faucet - dripping constantly for several days
- **Priority**: Normal
- **Status**: Resolved
- **Notes**: Normal - Plumber replaced washer/O-ring. Faucet working properly. Bathroom sink drip noted for future maintenance.

## Usage

### Running the Seed Script

```bash
node scripts/seed-conversation-threads.js
```

This will:

1. Create or use existing property
2. Create 3 tenants (or update if they exist)
3. Create 30 conversation messages (10 per tenant)
4. Create 3 maintenance requests linked to conversations

### Verifying the Data

```bash
node scripts/verify-conversation-threads.js
```

This will verify:

- All 3 tenants exist
- Each tenant has exactly 10 messages
- 3 maintenance requests exist with correct priorities
- Total counts match expectations

## Testing Scenarios

These conversation threads can be used to test:

### Dashboard Features

- **Conversations List**: View all 30 messages, filter by tenant
- **Conversation Detail**: View full thread with 10 messages
- **Maintenance Requests**: View 3 requests with different priorities
- **Priority Filtering**: Test filtering by emergency/urgent/normal
- **Status Updates**: Update maintenance request statuses

### AI Features

- **Emergency Detection**: Verify emergency messages trigger alerts
- **Priority Classification**: Verify correct priority assignment
- **Context Awareness**: Verify AI maintains conversation context
- **Action Extraction**: Verify maintenance requests created from conversations
- **Progressive Resolution**: Verify issue resolution through conversation

### Communication Channels

- **SMS Messages**: All messages are via SMS channel
- **Flagged Conversations**: Emergency messages are flagged
- **Timestamps**: Messages have realistic timestamps
- **Response Quality**: AI provides helpful, contextual responses

## Data Structure

### Tenants Table

```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  lease_terms JSONB,
  move_in_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Conversations Table

```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  channel VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  ai_actions JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  flagged BOOLEAN DEFAULT FALSE
);
```

### Maintenance Requests Table

```sql
CREATE TABLE maintenance_requests (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  tenant_id INTEGER REFERENCES tenants(id),
  conversation_id INTEGER REFERENCES conversations(id),
  issue_description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

## Notes

- All conversations are linked to tenants via `tenant_id`
- Maintenance requests are linked to conversations via `conversation_id`
- Emergency conversations have `flagged = true` for the first few messages
- AI actions are stored as JSONB in `ai_actions` column
- Timestamps are staggered to show realistic conversation progression
- Each tenant has a single, focused issue that develops through conversation

## Future Enhancements

Potential additions to this mock data:

1. **Low Priority Scenario**: Add a tenant with low-priority issue (e.g., loose cabinet door)
2. **Email Channel**: Add conversations via email channel
3. **WhatsApp Channel**: Add conversations via WhatsApp channel
4. **Unresolved Issues**: Add conversations with ongoing issues
5. **Multi-Issue Conversations**: Add conversations where multiple issues are discussed
6. **Follow-Up Messages**: Add follow-up conversations after resolution

## Cleanup

To remove this mock data and start fresh:

```sql
-- Delete conversations (cascades to maintenance requests)
DELETE FROM conversations WHERE tenant_id IN (5, 6, 7);

-- Delete tenants
DELETE FROM tenants WHERE id IN (5, 6, 7);
```

Or run the seed script again - it uses `ON CONFLICT DO UPDATE` for tenants, so it will update existing data rather than create duplicates.
