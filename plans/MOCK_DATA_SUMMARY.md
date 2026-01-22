# Mock Data Seeding Complete

## Summary

Successfully populated the database with comprehensive test data for testing the AI Property Management System.

## Data Created

### Properties

- **1 Property**: 123 Main Street, San Francisco, CA
  - Owner: John Smith
  - Amenities: WiFi, parking, laundry, gym, pool
  - Rules: Quiet hours, guest policy, pet policy, smoking policy, rent due date

### Tenants (3)

1. **Alice Johnson** (ID: 2)
   - Phone: +1-555-0202
   - Email: alice.johnson@example.com
   - Rent: $2,500/month
   - Lease: Jan 1 - Dec 31, 2024

2. **Bob Martinez** (ID: 3)
   - Phone: +1-555-0203
   - Email: bob.martinez@example.com
   - Rent: $2,800/month
   - Lease: Feb 1 - Dec 31, 2024

3. **Carol Williams** (ID: 4)
   - Phone: +1-555-0204
   - Email: carol.williams@example.com
   - Rent: $2,300/month
   - Lease: Mar 1 - Dec 31, 2024

### Conversations (10)

#### Emergency Issues (2)

1. **Burst Pipe/Flooding** (Alice Johnson)
   - Channel: SMS
   - Message: "HELP! There's water everywhere! A pipe burst in the bathroom and it's flooding the apartment!"
   - Response: Emergency alert with immediate manager notification
   - AI Actions: Emergency maintenance request + immediate manager alert
   - Flagged: Yes

2. **Gas Leak** (Bob Martinez)
   - Channel: SMS
   - Message: "I smell gas really strongly in the kitchen! What should I do?"
   - Response: Evacuation instructions + 911 call + immediate manager alert
   - AI Actions: Emergency maintenance request + immediate manager alert
   - Flagged: Yes

#### Urgent Issues (2)

3. **No Heat** (Carol Williams)
   - Channel: SMS
   - Message: "The heating is not working and it's freezing in here. It's been off since last night."
   - Response: Urgent maintenance request + space heater advice
   - AI Actions: Urgent maintenance request

4. **No Water** (Alice Johnson)
   - Channel: SMS
   - Message: "There's no water coming out of any of the faucets. I can't shower or cook!"
   - Response: Urgent maintenance request + building management contact
   - AI Actions: Urgent maintenance request

#### Normal Issues (2)

5. **Leaky Faucet** (Bob Martinez)
   - Channel: SMS
   - Message: "The kitchen faucet has been dripping constantly for a few days. It's annoying and wasting water."
   - Response: Normal maintenance request + DIY tip
   - AI Actions: Normal maintenance request

6. **Flickering Light** (Carol Williams)
   - Channel: SMS
   - Message: "The light in the hallway keeps flickering and sometimes goes out completely. It's one near the bathroom."
   - Response: Normal maintenance request + electrician scheduling
   - AI Actions: Normal maintenance request

#### Low Priority Issues (2)

7. **Paint Touch-up** (Alice Johnson)
   - Channel: Email
   - Message: "There are some small scuff marks on the wall from when I moved in. Can someone come touch up the paint?"
   - Response: Low-priority maintenance request + scheduling info
   - AI Actions: Low-priority maintenance request

8. **Loose Cabinet Door** (Bob Martinez)
   - Channel: Email
   - Message: "One of the kitchen cabinet doors is a bit loose and doesn't close properly. It's not urgent but would be nice to get fixed."
   - Response: Low-priority maintenance request + routine visit scheduling
   - AI Actions: Low-priority maintenance request

#### General Inquiries (2)

9. **WiFi Password** (Carol Williams)
   - Channel: SMS
   - Message: "Hi, I forgot the WiFi password. Can you remind me?"
   - Response: WiFi credentials provided
   - AI Actions: None

10. **Rent Due Date** (Alice Johnson)
    - Channel: Email
    - Message: "When is rent due this month? I want to make sure I pay on time."
    - Response: Rent due date + payment methods
    - AI Actions: None

### Maintenance Requests (8)

By Priority:

- **Emergency**: 2 requests
  - Burst pipe causing flooding (open)
  - Strong gas smell in kitchen (open)

- **Urgent**: 2 requests
  - Heating system not working (open)
  - No water supply to apartment (in_progress)

- **Normal**: 2 requests
  - Leaky kitchen faucet (open)
  - Flickering hallway light fixture (open)

- **Low**: 2 requests
  - Minor paint touch-ups needed (open)
  - Loose kitchen cabinet door (open)

## Testing Scenarios

The mock data enables testing of:

1. **Emergency Detection & Escalation**
   - Burst pipe scenario with immediate manager alert
   - Gas leak scenario with evacuation instructions

2. **Priority-Based Routing**
   - Emergency → SMS alerts
   - Urgent → SMS alerts
   - Normal/Low → Email notifications

3. **Multi-Channel Communication**
   - SMS for urgent/emergency issues
   - Email for general inquiries and low-priority issues

4. **AI Action Extraction**
   - JSON action blocks in responses
   - Maintenance request creation
   - Manager alert generation

5. **Dashboard Functionality**
   - Conversation history with search and filters
   - Maintenance request management with status updates
   - Priority-based sorting and filtering
   - Flagged conversations for review

6. **Conversation Context**
   - Property-specific information (amenities, rules)
   - Tenant-specific information (lease terms, contact info)
   - Conversation history tracking

## How to Use

### Run the Mock Data Script

```bash
node scripts/seed-mock-data.js
```

### Clear and Reset Data

To clear all data and start fresh:

```bash
psql -U postgres -d property_manager -c "TRUNCATE TABLE maintenance_requests, conversations, tenants, properties CASCADE;"
```

Then run the seed script again.

### Test the Dashboard

1. Start the backend server: `npm start`
2. Start the dashboard: `cd dashboard && npm run dev`
3. Login to the dashboard
4. Navigate to:
   - **Conversations**: View all 10 conversations with different issues
   - **Maintenance**: Filter by priority (emergency, urgent, normal, low)
   - **Properties**: View property details and associated tenants

### Test AI Responses

The mock conversations include realistic AI responses that demonstrate:

- Emergency protocols and immediate action
- Priority classification
- Helpful, contextual responses
- Action extraction (JSON blocks)
- Professional tone and tenant support

## Next Steps

With this mock data in place, you can now:

1. Test the dashboard UI with real data
2. Verify maintenance request filtering and sorting
3. Test conversation search functionality
4. Validate priority-based notification routing
5. Review flagged conversations for quality assurance
6. Test status updates on maintenance requests
7. Verify analytics and reporting features

## Data Distribution

- **Total Conversations**: 10
- **Conversations with Maintenance Requests**: 8
- **Conversations with AI Actions**: 8
- **Flagged Conversations**: 2 (emergencies)
- **Maintenance Requests by Priority**: 2 emergency, 2 urgent, 2 normal, 2 low
- **Channels**: 6 SMS, 2 Email, 2 General Inquiries
- **Time Range**: 2 hours ago to 5 days ago

This comprehensive mock data set provides a realistic testing environment for all major features of the AI Property Management System.
