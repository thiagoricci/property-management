# Notification Fix Summary

## Problem

Notifications were not being sent to property managers when maintenance requests were created or emergencies were detected. The error messages showed:

```
Twilio SMS error: Error: Required parameter "params['to']" missing.
Failed to log notification: error: null value in column "recipient" of relation "notifications" violates not-null constraint
```

## Root Cause

The notification service functions (`notifyManagerOfMaintenanceRequest`, `notifyManagerOfEmergency`, `notifyManagerOfEscalation`) expected 5 parameters:

1. `maintenanceRequest` / `reason` / `thread`
2. `tenant`
3. `property`
4. `managerPhone` (REQUIRED)
5. `managerEmail` (REQUIRED)

However, in `src/routes/webhooks.js`, these functions were being called with only 3 parameters, leaving `managerPhone` and `managerEmail` as `undefined`.

## Solution

### 1. Added `getAdminContactInfo()` function to `webhooks.js`

This function retrieves admin user contact information from the database, with a fallback to property owner's contact info if admin user data is incomplete.

```javascript
async function getAdminContactInfo(propertyId = null) {
  try {
    // First, try to get admin user contact info
    const adminResult = await db.query(
      "SELECT email, phone FROM users ORDER BY id LIMIT 1",
    );

    let adminEmail = null;
    let adminPhone = null;

    if (adminResult.rows.length > 0) {
      adminEmail = adminResult.rows[0].email;
      adminPhone = adminResult.rows[0].phone;
    }

    // If admin user doesn't have phone/email, try property owner as fallback
    if ((!adminEmail || !adminPhone) && propertyId) {
      console.warn(
        "Admin user contact info incomplete. Trying property owner as fallback.",
      );
      const propertyResult = await db.query(
        "SELECT owner_email, owner_phone FROM properties WHERE id = $1",
        [propertyId],
      );

      if (propertyResult.rows.length > 0) {
        if (!adminEmail) {
          adminEmail = propertyResult.rows[0].owner_email;
        }
        if (!adminPhone) {
          adminPhone = propertyResult.rows[0].owner_phone;
        }
      }
    }

    return {
      email: adminEmail,
      phone: adminPhone,
    };
  } catch (error) {
    console.error("Error fetching admin contact info:", error);
    return { email: null, phone: null };
  }
}
```

### 2. Updated `createMaintenanceRequest()` in `webhooks.js`

Added admin contact retrieval and passed required parameters to notification service:

```javascript
// Get admin user contact information (with property owner fallback)
const adminContact = await getAdminContactInfo(propertyId);

if (!adminContact.email && !adminContact.phone) {
  console.warn(
    "No admin contact information available. Cannot send notification.",
  );
}

// Notify manager about new maintenance request
const notificationResult =
  await notificationService.notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property,
    adminContact.phone,
    adminContact.email,
  );
```

### 3. Updated `alertManager()` in `webhooks.js`

Added admin contact retrieval and passed required parameters to notification service:

```javascript
// Get admin user contact information (with property owner fallback)
const adminContact = await getAdminContactInfo(propertyId);

if (!adminContact.email && !adminContact.phone) {
  console.warn(
    "No admin contact information available. Cannot send emergency notification.",
  );
}

// Send emergency notification via notification service
const result = await notificationService.notifyManagerOfEmergency(
  reason,
  tenant,
  property,
  adminContact.phone,
  adminContact.email,
);
```

### 4. Enhanced `sendNotification()` in `notificationService.js`

Added validation to check if required contact information is available before attempting to send notifications:

```javascript
// Check if we have the required contact information for the chosen channel
if (channel === "sms" && !recipientPhone) {
  throw new Error("Recipient phone number is missing for SMS notification");
}
if (channel === "email" && !recipientEmail) {
  throw new Error("Recipient email address is missing for email notification");
}
```

## Files Modified

1. **src/routes/webhooks.js**
   - Added `getAdminContactInfo()` function
   - Updated `createMaintenanceRequest()` to pass manager phone and email
   - Updated `alertManager()` to pass manager phone and email

2. **src/services/notificationService.js**
   - Enhanced `sendNotification()` with validation for missing contact info

## Database State

The admin user in the database has both contact methods configured:

```
id | email            | phone
----+-------------------+---------------
1  | admin@example.com  | +15038209457
```

## How It Works Now

1. **Maintenance Request Created:**
   - System retrieves admin user's phone and email from database
   - Falls back to property owner's contact info if admin data is incomplete
   - Sends notification based on priority:
     - Emergency/Urgent → SMS
     - Normal/Low → Email
   - Logs notification to database with recipient, message, channel, and status

2. **Emergency Alert:**
   - System retrieves admin user's phone and email
   - Always sends via SMS for immediate attention
   - Logs notification to database

## Testing

To test the fix:

1. Send an SMS to the Twilio number with a maintenance issue
2. Verify that:
   - Maintenance request is created in database
   - Notification is sent to admin user (+15038209457)
   - Notification is logged in `notifications` table with status "sent"

## Other Files

The following files were already correctly passing required parameters:

- `src/routes/maintenance.js` - ✅ Correct
- `src/routes/threads.js` - ✅ Correct
- `src/routes/messages.js` - ✅ Correct

Only `src/routes/webhooks.js` needed to be fixed.
