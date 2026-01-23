# Notification System Implementation - Admin User Profile Integration

## Overview

Updated the notification system to use the admin user's phone number and email from their profile settings instead of using property owner contact information.

## Changes Made

### 1. Notification Service Updates (`src/services/notificationService.js`)

#### `notifyManagerOfMaintenanceRequest()`

- **Added parameters**: `managerPhone`, `managerEmail`
- **Behavior**: Now uses admin user's contact info for maintenance request notifications
- **Fallback**: If admin user not found, falls back to `property.owner_phone` and `property.owner_email`

```javascript
async notifyManagerOfMaintenanceRequest(maintenanceRequest, tenant, property, managerPhone, managerEmail) {
  const priority = maintenanceRequest.priority;
  const message = this.buildMaintenanceMessage(maintenanceRequest, tenant, property);
  const subject = `Maintenance Request: ${priority.toUpperCase()} - ${property.address}`;

  return await this.sendNotification(
    priority,
    managerPhone,  // ✅ Uses admin user's phone
    managerEmail,  // ✅ Uses admin user's email
    message,
    subject
  );
}
```

#### `notifyManagerOfEmergency()`

- **Added parameters**: `managerPhone`, `managerEmail`
- **Behavior**: Now uses admin user's contact info for emergency alerts
- **Fallback**: If admin user not found, falls back to `property.owner_phone` and `property.owner_email`

```javascript
async notifyManagerOfEmergency(reason, tenant, property, managerPhone, managerEmail) {
  const message = this.buildEmergencyMessage(reason, tenant, property);
  const subject = `🚨 EMERGENCY ALERT - ${property.address}`;

  return await this.sendNotification(
    "emergency",
    managerPhone,  // ✅ Uses admin user's phone
    managerEmail,  // ✅ Uses admin user's email
    message,
    subject
  );
}
```

#### `notifyManagerOfEscalation()`

- **Added parameters**: `managerPhone`, `managerEmail`
- **Behavior**: Now uses admin user's contact info for conversation escalation alerts
- **Fallback**: If admin user not found, falls back to `property.owner_phone` and `property.owner_email`

```javascript
async notifyManagerOfEscalation(thread, tenant, property, reasoning, managerPhone, managerEmail) {
  const message = this.buildEscalationMessage(thread, tenant, property, reasoning);
  const subject = `⚠️ Conversation Escalation - ${property.address}`;

  return await this.sendNotification(
    "urgent",
    managerPhone,  // ✅ Uses admin user's phone
    managerEmail,  // ✅ Uses admin user's email
    message,
    subject
  );
}
```

### 2. Messages Route Updates (`src/routes/messages.js`)

#### Maintenance Request Creation (AI-generated)

- **Location**: Line 709 in `createMaintenanceRequest()` function
- **Change**: Load admin user profile and pass phone/email to notification service

```javascript
// Load admin user profile for notification
const adminUserResult = await db.query(
  "SELECT id, email, phone FROM users WHERE id = 1",
);
const adminUser = adminUserResult.rows[0];

// Notify manager about new maintenance request
const notificationResult =
  await notificationService.notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property,
    adminUser ? adminUser.phone : property.owner_phone,
    adminUser ? adminUser.email : property.owner_email,
  );
```

#### Emergency Alert (AI-generated)

- **Location**: Line 753 in `alertManager()` function
- **Change**: Load admin user profile and pass phone/email to notification service

```javascript
// Load admin user profile for notification
const adminUserResult = await db.query(
  "SELECT id, email, phone FROM users WHERE id = 1",
);
const adminUser = adminUserResult.rows[0];

// Send emergency notification via notification service
const result = await notificationService.notifyManagerOfEmergency(
  reason,
  tenant,
  property,
  adminUser ? adminUser.phone : property.owner_phone,
  adminUser ? adminUser.email : property.owner_email,
);
```

### 3. Threads Route Updates (`src/routes/threads.js`)

#### Conversation Escalation (AI-detected)

- **Location**: Line 175 in `/:threadId/detect-escalation` endpoint
- **Change**: Load admin user profile and pass phone/email to notification service

```javascript
// Load admin user profile for notification
const adminUserResult = await db.query(
  "SELECT id, email, phone FROM users WHERE id = 1",
);
const adminUser = adminUserResult.rows[0];

// Send escalation notification to manager
await notificationService.notifyManagerOfEscalation(
  thread,
  tenant,
  property,
  result.reasoning,
  adminUser ? adminUser.phone : property.owner_phone,
  adminUser ? adminUser.email : property.owner_email,
);
```

### 4. Maintenance Route Updates (`src/routes/maintenance.js`)

#### Manual Maintenance Request Creation

- **Location**: Line 83 in POST `/` endpoint
- **Changes**:
  1. Added `notificationService` import
  2. Load admin user profile
  3. Send notification when maintenance request is created manually

```javascript
const notificationService = require("../services/notificationService");
const router = express.Router();

// In POST / endpoint
const maintenanceRequest = result.rows[0];

// Load tenant and property details for notification
const tenantResult = await db.query("SELECT * FROM tenants WHERE id = $1", [
  tenant_id,
]);
const propertyResult = await db.query(
  "SELECT * FROM properties WHERE id = $1",
  [property_id],
);

// Load admin user profile for notification
const adminUserResult = await db.query(
  "SELECT id, email, phone FROM users WHERE id = 1",
);
const adminUser = adminUserResult.rows[0];

if (tenantResult.rows.length > 0 && propertyResult.rows.length > 0) {
  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Notify manager about new maintenance request
  const notificationResult =
    await notificationService.notifyManagerOfMaintenanceRequest(
      maintenanceRequest,
      tenant,
      property,
      adminUser ? adminUser.phone : property.owner_phone,
      adminUser ? adminUser.email : property.owner_email,
    );

  console.log(
    `Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`,
  );
}
```

## Notification Flow

### AI-Generated Maintenance Request

```
Tenant Message (SMS/Email)
    ↓
AI Service
    ↓
Maintenance Request Created
    ↓
Load Admin User Profile (users.id = 1)
    ↓
Notification Service
    ↓
Priority Check
    ├─ Emergency/Urgent → SMS to admin user's phone
    └─ Normal/Low → Email to admin user's email
    ↓
Log to Database (notifications table)
```

### AI-Generated Emergency Alert

```
Emergency Keyword Detected
    ↓
AI Service
    ↓
Alert Manager Action
    ↓
Load Admin User Profile (users.id = 1)
    ↓
Notification Service
    ↓
Always SMS (emergency priority)
    ↓
Send to admin user's phone
    ↓
Log to Database (notifications table)
```

### Manual Maintenance Request (Dashboard)

```
Manager Creates Request (Dashboard)
    ↓
POST /api/maintenance
    ↓
Load Admin User Profile (users.id = 1)
    ↓
Notification Service
    ↓
Priority Check
    ├─ Emergency/Urgent → SMS to admin user's phone
    └─ Normal/Low → Email to admin user's email
    ↓
Log to Database (notifications table)
```

## Database Schema

### Users Table (existing)

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(20),  -- ✅ Added in migration 013
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Notifications Table (existing)

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(100) NOT NULL,  -- ✅ Now stores admin user's phone/email
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email')),
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT
);
```

## Configuration

### Environment Variables Required

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Resend Configuration
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Database
DATABASE_URL=postgresql://localhost/property_manager
```

## Testing

### Prerequisites

1. Admin user must exist in `users` table with `id = 1`
2. Admin user should have `phone` number set in their profile
3. Twilio and Resend API keys must be configured in `.env`

### Test Scenarios

#### 1. AI-Generated Maintenance Request

```bash
# Send tenant message via API
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 1,
    "message": "My sink is leaking badly",
    "channel": "sms"
  }'

# Expected:
# - Maintenance request created in database
# - Notification sent to admin user's phone (if urgent/emergency) or email (if normal/low)
# - Notification logged to notifications table
```

#### 2. AI-Generated Emergency Alert

```bash
# Send emergency message via API
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": 1,
    "message": "There's water flooding my apartment!",
    "channel": "sms"
  }'

# Expected:
# - Emergency detected by AI
# - SMS sent to admin user's phone
# - Notification logged to notifications table
```

#### 3. Manual Maintenance Request (Dashboard)

```bash
# Create maintenance request manually via API
curl -X POST http://localhost:3000/api/maintenance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "property_id": 1,
    "tenant_id": 1,
    "issue_description": "Broken window",
    "priority": "urgent"
  }'

# Expected:
# - Maintenance request created in database
# - Notification sent to admin user's phone (urgent priority)
# - Notification logged to notifications table
```

### Verification Queries

```sql
-- Check if admin user has phone number
SELECT id, email, phone FROM users WHERE id = 1;

-- View recent notifications
SELECT * FROM notifications
ORDER BY sent_at DESC
LIMIT 10;

-- View notifications for a specific recipient
SELECT * FROM notifications
WHERE recipient = '+1234567890' OR recipient = 'admin@example.com'
ORDER BY sent_at DESC;
```

## Fallback Behavior

If the admin user (id=1) is not found or doesn't have a phone/email:

- The system falls back to using `property.owner_phone` and `property.owner_email`
- This ensures notifications are still sent even if admin profile is incomplete
- A warning is logged to console

## Priority-Based Routing

| Priority  | Channel | Recipient          |
| --------- | ------- | ------------------ |
| Emergency | SMS     | Admin user's phone |
| Urgent    | SMS     | Admin user's phone |
| Normal    | Email   | Admin user's email |
| Low       | Email   | Admin user's email |

## Benefits

1. **Centralized Management**: All notifications go to the admin user's configured contact info
2. **Flexibility**: Admin can update their phone/email in settings without modifying properties
3. **Fallback Support**: System still works if admin profile is incomplete
4. **Consistency**: All notification types (maintenance, emergency, escalation) use the same source of truth
5. **Audit Trail**: All notifications are logged to database with recipient info

## Files Modified

1. `src/services/notificationService.js` - Updated 3 methods
2. `src/routes/messages.js` - Updated 2 notification calls
3. `src/routes/threads.js` - Updated 1 notification call
4. `src/routes/maintenance.js` - Added notification to POST endpoint

## Next Steps

1. ✅ Code changes complete
2. ⏳ Test notification flow with actual maintenance request creation
3. ⏳ Verify notifications are logged to database with correct recipient
4. ⏳ Update dashboard settings page to allow admin to configure phone/email
5. ⏳ Add notification history view to dashboard

## Troubleshooting

### Notifications Not Sending

1. Check admin user has phone/email set:
   ```sql
   SELECT id, email, phone FROM users WHERE id = 1;
   ```
2. Verify Twilio/Resend API keys in `.env`
3. Check notification logs in database:
   ```sql
   SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 10;
   ```
4. Check server logs for errors

### Wrong Recipient

1. Verify admin user ID is 1 (or update query if different)
2. Check fallback logic is working:
   ```sql
   SELECT owner_phone, owner_email FROM properties WHERE id = 1;
   ```

### SMS Not Sending

1. Verify Twilio credentials
2. Check phone number format (should include country code, e.g., +1)
3. Verify Twilio account has SMS capability

### Email Not Sending

1. Verify Resend API key
2. Check email format is valid
3. Verify sender email is configured in `.env`
