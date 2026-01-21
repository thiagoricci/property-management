# Step 6: Implement Action Execution - Implementation Plan

## Overview

This step completes the core loop by implementing actual manager notifications when AI detects maintenance requests or emergencies. Currently, the AI extracts actions but they're only logged - managers don't receive alerts.

## Current State

### What's Working ✅

- AI action extraction from responses (maintenance_request, alert_manager)
- Maintenance request creation in database
- Twilio SMS sending configured (src/config/twilio.js)
- Database notifications table exists
- Resend package installed in package.json

### What's Missing ❌

- Resend configuration file
- Notification service module
- Actual manager notifications (alertManager is placeholder)
- Priority-based routing (emergency → SMS, normal → email)
- Database notification logging
- Tenant confirmation messages after action execution

## Implementation Plan

### 1. Create Resend Configuration

**File:** `src/config/resend.js`

```javascript
const { Resend } = require("resend");

// Validate required environment variables
if (!process.env.RESEND_API_KEY) {
  console.warn(
    "WARNING: Resend API key not configured. Email functionality will not work.",
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email via Resend
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} text - Plain text content
 * @param {String} html - HTML content (optional)
 * @returns {Promise<Object>} Resend email object
 */
async function sendEmail(to, subject, text, html = null) {
  try {
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || "noreply@propertymanager.ai",
      to: to,
      subject: subject,
      text: text,
    };

    // Add HTML if provided
    if (html) {
      emailData.html = html;
    }

    const result = await resend.emails.send(emailData);

    console.log(`Email sent to ${to}: ID ${result.data.id}`);
    return result;
  } catch (error) {
    console.error("Resend email error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = {
  resend,
  sendEmail,
};
```

**Environment Variables Needed:**

```
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 2. Create Notification Service Module

**File:** `src/services/notificationService.js`

```javascript
const twilio = require("../config/twilio");
const resend = require("../config/resend");
const db = require("../config/database");

class NotificationService {
  /**
   * Send notification based on priority
   * @param {String} priority - Priority level (emergency, urgent, normal, low)
   * @param {String} recipientPhone - Manager phone number
   * @param {String} recipientEmail - Manager email address
   * @param {String} message - Notification message
   * @param {String} subject - Email subject (for email notifications)
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(
    priority,
    recipientPhone,
    recipientEmail,
    message,
    subject = "Property Manager Alert",
  ) {
    const channel = this.determineChannel(priority);
    let result;

    try {
      if (channel === "sms") {
        result = await twilio.sendSMS(recipientPhone, message);
      } else if (channel === "email") {
        result = await resend.sendEmail(recipientEmail, subject, message);
      }

      // Log notification to database
      await this.logNotification(
        channel === "sms" ? recipientPhone : recipientEmail,
        message,
        channel,
        "sent",
      );

      return {
        success: true,
        channel,
        result,
      };
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error);

      // Log failed notification
      await this.logNotification(
        channel === "sms" ? recipientPhone : recipientEmail,
        message,
        channel,
        "failed",
        error.message,
      );

      return {
        success: false,
        channel,
        error: error.message,
      };
    }
  }

  /**
   * Determine notification channel based on priority
   * @param {String} priority - Priority level
   * @returns {String} Channel ('sms' or 'email')
   */
  determineChannel(priority) {
    // Emergency and urgent get SMS for immediate attention
    if (priority === "emergency" || priority === "urgent") {
      return "sms";
    }

    // Normal and low get email
    return "email";
  }

  /**
   * Log notification to database
   * @param {String} recipient - Recipient (phone or email)
   * @param {String} message - Message content
   * @param {String} channel - Channel used
   * @param {String} status - Status (sent, failed)
   * @param {String} errorMessage - Error message if failed
   */
  async logNotification(
    recipient,
    message,
    channel,
    status,
    errorMessage = null,
  ) {
    try {
      await db.query(
        `INSERT INTO notifications (recipient, message, channel, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [recipient, message, channel, status, errorMessage],
      );
    } catch (error) {
      console.error("Failed to log notification:", error);
    }
  }

  /**
   * Send maintenance request notification to manager
   * @param {Object} maintenanceRequest - Maintenance request details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfMaintenanceRequest(
    maintenanceRequest,
    tenant,
    property,
  ) {
    const priority = maintenanceRequest.priority;
    const message = this.buildMaintenanceMessage(
      maintenanceRequest,
      tenant,
      property,
    );
    const subject = `Maintenance Request: ${priority.toUpperCase()} - ${property.address}`;

    return await this.sendNotification(
      priority,
      property.owner_phone,
      property.owner_email,
      message,
      subject,
    );
  }

  /**
   * Build maintenance request notification message
   * @param {Object} maintenanceRequest - Maintenance request details
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {String} Formatted message
   */
  buildMaintenanceMessage(maintenanceRequest, tenant, property) {
    const priorityEmoji = {
      emergency: "🚨",
      urgent: "⚠️",
      normal: "🔧",
      low: "📝",
    };

    return `${priorityEmoji[maintenanceRequest.priority] || ""} Maintenance Request

Property: ${property.address}
Priority: ${maintenanceRequest.priority.toUpperCase()}
Tenant: ${tenant.name}
Phone: ${tenant.phone}

Issue: ${maintenanceRequest.issue_description}

Request ID: ${maintenanceRequest.id}
Created: ${new Date(maintenanceRequest.created_at).toLocaleString()}

Please review and take action in the dashboard.`;
  }

  /**
   * Send emergency alert to manager
   * @param {String} reason - Emergency reason
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {Promise<Object>} Notification result
   */
  async notifyManagerOfEmergency(reason, tenant, property) {
    const message = this.buildEmergencyMessage(reason, tenant, property);
    const subject = `🚨 EMERGENCY ALERT - ${property.address}`;

    // Always use SMS for emergencies
    return await this.sendNotification(
      "emergency",
      property.owner_phone,
      property.owner_email,
      message,
      subject,
    );
  }

  /**
   * Build emergency alert message
   * @param {String} reason - Emergency reason
   * @param {Object} tenant - Tenant details
   * @param {Object} property - Property details
   * @returns {String} Formatted message
   */
  buildEmergencyMessage(reason, tenant, property) {
    return `🚨 EMERGENCY ALERT 🚨

Property: ${property.address}
Tenant: ${tenant.name}
Phone: ${tenant.phone}

Reason: ${reason}

Time: ${new Date().toLocaleString()}

IMMEDIATE ACTION REQUIRED!`;
  }

  /**
   * Send confirmation message to tenant
   * @param {String} tenantPhone - Tenant phone number
   * @param {String} tenantEmail - Tenant email
   * @param {String} message - Confirmation message
   * @param {String} channel - Preferred channel
   * @returns {Promise<Object>} Notification result
   */
  async sendTenantConfirmation(
    tenantPhone,
    tenantEmail,
    message,
    channel = "sms",
  ) {
    try {
      let result;

      if (channel === "sms" && tenantPhone) {
        result = await twilio.sendSMS(tenantPhone, message);
      } else if (channel === "email" && tenantEmail) {
        result = await resend.sendEmail(tenantEmail, "Confirmation", message);
      } else {
        // Fallback to SMS if preferred channel not available
        if (tenantPhone) {
          result = await twilio.sendSMS(tenantPhone, message);
        } else {
          throw new Error("No valid contact method available for tenant");
        }
      }

      return {
        success: true,
        channel,
        result,
      };
    } catch (error) {
      console.error("Failed to send tenant confirmation:", error);
      return {
        success: false,
        channel,
        error: error.message,
      };
    }
  }
}

module.exports = new NotificationService();
```

### 3. Update Messages Route to Use Notification Service

**File:** `src/routes/messages.js`

**Changes needed:**

1. Import notification service:

```javascript
const notificationService = require("../services/notificationService");
```

2. Update `alertManager` function (replace placeholder):

```javascript
/**
 * Alert property manager about emergency or urgent issue
 */
async function alertManager(action, tenantId, propertyId) {
  const { urgency, reason } = action;

  // Load tenant and property details
  const tenantResult = await db.query("SELECT * FROM tenants WHERE id = $1", [
    tenantId,
  ]);
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId],
  );

  if (tenantResult.rows.length === 0 || propertyResult.rows.length === 0) {
    throw new Error("Tenant or property not found");
  }

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Send emergency notification
  const result = await notificationService.notifyManagerOfEmergency(
    reason,
    tenant,
    property,
  );

  console.log(`Emergency alert sent: ${urgency} - ${reason}`);

  return {
    type: "alert_manager",
    urgency,
    reason,
    notification: result,
  };
}
```

3. Update `createMaintenanceRequest` function to notify manager:

```javascript
/**
 * Create maintenance request from AI action
 */
async function createMaintenanceRequest(
  action,
  tenantId,
  propertyId,
  conversationId,
) {
  const { priority, description } = action;

  if (!priority || !description) {
    throw new Error("Missing required fields for maintenance request");
  }

  // Create maintenance request in database
  const result = await db.query(
    `INSERT INTO maintenance_requests
       (property_id, tenant_id, conversation_id, issue_description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
    [propertyId, tenantId, conversationId, description, priority],
  );

  const maintenanceRequest = result.rows[0];

  // Load tenant and property details
  const tenantResult = await db.query("SELECT * FROM tenants WHERE id = $1", [
    tenantId,
  ]);
  const propertyResult = await db.query(
    "SELECT * FROM properties WHERE id = $1",
    [propertyId],
  );

  const tenant = tenantResult.rows[0];
  const property = propertyResult.rows[0];

  // Notify manager about new maintenance request
  const notificationResult =
    await notificationService.notifyManagerOfMaintenanceRequest(
      maintenanceRequest,
      tenant,
      property,
    );

  console.log(
    `Created maintenance request: ${maintenanceRequest.id} with priority: ${priority}`,
  );
  console.log(
    `Manager notification sent: ${notificationResult.success ? "SUCCESS" : "FAILED"}`,
  );

  // Send confirmation to tenant
  const confirmationMessage = buildTenantConfirmation(priority);
  await notificationService.sendTenantConfirmation(
    tenant.phone,
    tenant.email,
    confirmationMessage,
    "sms", // Default to SMS for immediate confirmation
  );

  return {
    type: "maintenance_request",
    request_id: maintenanceRequest.id,
    priority,
    notification: notificationResult,
  };
}

/**
 * Build tenant confirmation message
 */
function buildTenantConfirmation(priority) {
  const messages = {
    emergency:
      "🚨 EMERGENCY: Your report has been received and your property manager has been notified immediately. If this is a life-threatening emergency, please call 911.",
    urgent:
      "⚠️ Your urgent request has been received and your property manager has been notified. They will address this as soon as possible.",
    normal:
      "✅ Your maintenance request has been received. Your property manager has been notified and will review it shortly.",
    low: "📝 Your request has been logged. Your property manager will review it at their earliest convenience.",
  };

  return messages[priority] || messages.normal;
}
```

### 4. Update Webhook Route for SMS

**File:** `src/routes/webhooks.js`

**Changes needed:**

1. Import notification service:

```javascript
const notificationService = require("../services/notificationService");
```

2. Update the webhook handler to use the updated action execution from messages.js (which now includes notifications)

### 5. Environment Variables

**Add to `.env`:**

```env
# Resend Email Configuration
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Add to `.env.example`:**

```env
# Resend Email Configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Testing Plan

### Test 1: Emergency Maintenance Request

1. Tenant sends SMS: "There's a burst pipe and water is flooding my apartment!"
2. Verify:
   - AI detects emergency
   - Maintenance request created in database with priority "emergency"
   - Manager receives SMS notification
   - Tenant receives confirmation SMS
   - Notification logged to database

### Test 2: Normal Maintenance Request

1. Tenant sends SMS: "My kitchen faucet is dripping"
2. Verify:
   - AI detects maintenance issue
   - Maintenance request created in database with priority "normal"
   - Manager receives email notification
   - Tenant receives confirmation SMS
   - Notification logged to database

### Test 3: General Inquiry (No Action)

1. Tenant sends SMS: "When is rent due?"
2. Verify:
   - AI answers question
   - No maintenance request created
   - No manager notification sent
   - Conversation logged to database

## Validation Criteria

Step 6 is complete when:

- ✅ Resend configuration file created and working
- ✅ Notification service module created with all methods
- ✅ Manager receives SMS for emergency/urgent requests
- ✅ Manager receives email for normal/low requests
- ✅ Tenant receives confirmation messages
- ✅ All notifications logged to database
- ✅ Error handling for failed notifications
- ✅ Full end-to-end flow tested and working

## Next Steps After Step 6

Once Step 6 is complete, the core loop is fully functional:

- Tenant sends message → AI responds → Action executed → Manager notified → Tenant confirmed

This completes Phase 1 Foundation. The next steps would be:

- Step 11: Improve AI Context Awareness
- Step 12: Emergency Detection & Escalation
- Step 13: Add Email Communication
- etc.

## Files to Create/Modify

### New Files:

1. `src/config/resend.js` - Resend email configuration
2. `src/services/notificationService.js` - Notification service module

### Modify Files:

1. `src/routes/messages.js` - Update alertManager and createMaintenanceRequest functions
2. `src/routes/webhooks.js` - Ensure webhook uses updated action execution
3. `.env` - Add Resend configuration
4. `.env.example` - Add Resend configuration template

## Dependencies

All required dependencies are already installed:

- ✅ resend (email sending)
- ✅ twilio (SMS sending)
- ✅ pg (database)

No additional npm packages needed.

## Cost Considerations

**SMS Notifications (Twilio):**

- Emergency/Urgent: ~$0.0079 per SMS
- Estimated: 10-20 emergency SMS/month = $0.08-0.16

**Email Notifications (Resend):**

- Normal/Low: Free tier (3,000 emails/month)
- Estimated: 50-100 normal emails/month = $0 (within free tier)

**Total Monthly Cost:** ~$0.08-0.16 for SMS notifications (negligible)
