# Step 13: Add Email Communication - Implementation Plan

## Overview

This plan details the implementation of email communication for the AI Property Manager, allowing tenants to communicate via email in addition to SMS. Email communication enables richer interactions including attachments (photos of maintenance issues) and provides a more professional communication channel.

## Current State

- **Resend API** configured for outbound emails ([`src/config/resend.js`](src/config/resend.js:1))
- **Twilio SMS** fully implemented with webhook handling ([`src/routes/webhooks.js`](src/routes/webhooks.js:1))
- **AI Service** supports context-aware responses ([`src/services/aiService.js`](src/services/aiService.js:1))
- **Notification Service** handles priority-based routing ([`src/services/notificationService.js`](src/services/notificationService.js:1))
- **Conversations table** already supports 'email' channel (via migration 002)

## Implementation Architecture

```
Tenant Email
    ↓
Resend Inbound Webhook
    ↓
POST /webhooks/email/inbound
    ↓
Parse Email (from, subject, body, attachments)
    ↓
Strip Signatures & Threads
    ↓
Lookup Tenant by Email
    ↓
Load Property & Context
    ↓
AI Service Generate Response
    ↓
Extract Actions (maintenance, alerts)
    ↓
Log Conversation
    ↓
Execute Actions
    ↓
Send Email Response via Resend
    ↓
Store Attachments (if any)
```

## Detailed Implementation Steps

### 1. Set Up Resend Inbound Email Configuration

**Goal**: Configure Resend to forward incoming emails to your server

**Actions**:

1. **Configure Resend Domain**
   - Purchase/verify a domain (e.g., `ai.yourdomain.com`)
   - Add MX records to DNS
   - Verify domain ownership in Resend dashboard

2. **Create Inbound Route**
   - In Resend dashboard, create an inbound route
   - Route all emails to: `https://your-server.com/webhooks/email/inbound`
   - Configure webhook signature verification (optional but recommended)

3. **Environment Variables**
   - Add to [`.env`](.env:1):
     ```env
     RESEND_INBOUND_WEBHOOK_SECRET=your-webhook-secret
     RESEND_INBOUND_EMAIL_DOMAIN=ai.yourdomain.com
     ```

**Validation**: Test email sent to tenant@ai.yourdomain.com reaches your server

---

### 2. Create POST /webhooks/email/inbound Endpoint

**File**: [`src/routes/webhooks.js`](src/routes/webhooks.js:1)

**Implementation**:

```javascript
/**
 * POST /webhooks/email/inbound
 * Handle incoming email messages from Resend
 *
 * Resend sends JSON payload with:
 * - from: Sender email address
 * - to: Recipient email address
 * - subject: Email subject line
 * - text: Plain text body
 * - html: HTML body (optional)
 * - attachments: Array of attachment objects
 */
router.post("/email/inbound", async (req, res) => {
  try {
    const { from, to, subject, text, html, attachments } = req.body;

    // Validate required fields
    if (!from || !text) {
      console.error("Missing required fields in email webhook");
      return res.status(400).json({ error: "Bad Request" });
    }

    console.log(`Received email from ${from}: ${subject}`);

    // Normalize email address (lowercase, trim)
    const normalizedEmail = normalizeEmailAddress(from);

    // Look up tenant by email address
    const tenantResult = await db.query(
      "SELECT * FROM tenants WHERE email = $1 OR email = $2",
      [from, normalizedEmail],
    );

    if (tenantResult.rows.length === 0) {
      // Tenant not recognized - send friendly email response
      console.log(`No tenant found for email: ${from}`);
      const unrecognizedMessage = buildUnrecognizedEmailMessage();

      // Send response asynchronously
      resend
        .sendEmail(
          from,
          "Property Manager - Unknown Sender",
          unrecognizedMessage,
        )
        .catch((err) =>
          console.error("Failed to send unrecognized email:", err),
        );

      return res.status(200).json({ status: "unrecognized_sender" });
    }

    const tenant = tenantResult.rows[0];
    console.log(`Found tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Strip email signatures and thread history
    const cleanedBody = stripEmailSignatures(text);
    const messageBody = cleanedBody || subject; // Use subject if body is empty

    // Load property information
    const propertyResult = await db.query(
      "SELECT * FROM properties WHERE id = $1",
      [tenant.property_id],
    );
    const property = propertyResult.rows[0] || null;

    // Load conversation history (last 15 messages)
    const historyResult = await db.query(
      `SELECT message, response
       FROM conversations
       WHERE tenant_id = $1
       ORDER BY timestamp DESC
       LIMIT 15`,
      [tenant.id],
    );

    // Load open maintenance requests for context
    const maintenanceResult = await db.query(
      `SELECT issue_description, priority, status
       FROM maintenance_requests
       WHERE tenant_id = $1
       AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenant.id],
    );

    // Format conversation history for OpenAI
    const conversationHistory = aiService.formatConversationHistory(
      historyResult.rows,
    );

    // Generate AI response with context
    const aiResponse = await aiService.generateResponse(
      property,
      tenant,
      conversationHistory,
      messageBody,
      maintenanceResult.rows,
    );

    // Extract actions from AI response
    const actions = aiService.extractActions(aiResponse);

    // Log conversation to database
    const conversationResult = await db.query(
      `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        tenant.id,
        "email",
        messageBody,
        aiResponse,
        actions.length > 0 ? JSON.stringify(actions) : null,
      ],
    );

    const savedConversation = conversationResult.rows[0];
    console.log(`Saved conversation: ${savedConversation.id}`);

    // Execute actions (maintenance requests, alerts, etc.)
    const executedActions = [];
    for (const action of actions) {
      try {
        const result = await executeAction(
          action,
          tenant.id,
          property ? property.id : null,
          savedConversation.id,
        );
        executedActions.push({ ...action, status: "executed", result });
      } catch (error) {
        console.error("Failed to execute action:", error);
        executedActions.push({
          ...action,
          status: "failed",
          error: error.message,
        });
      }
    }

    // Handle attachments (photos of issues)
    if (attachments && attachments.length > 0) {
      await handleEmailAttachments(attachments, savedConversation.id);
    }

    // Send AI response via email
    const cleanResponse = aiService.stripJSONFromResponse(aiResponse);
    const emailBody = buildEmailResponse(cleanResponse);

    try {
      await resend.sendEmail(
        from,
        "Re: " + (subject || "Property Manager Inquiry"),
        emailBody,
      );
      console.log(`Sent email response to ${from}`);
    } catch (error) {
      console.error("Failed to send email response:", error);
      // Don't fail webhook if email sending fails
    }

    // Return success response
    res.status(200).json({
      status: "processed",
      conversation_id: savedConversation.id,
      actions: executedActions,
    });
  } catch (error) {
    console.error("Email webhook error:", error);
    res.status(500).json({ error: "Failed to process email" });
  }
});
```

**Validation**: Test email triggers webhook and receives AI response

---

### 3. Implement Email Parsing Utilities

**File**: Create `src/utils/emailParser.js`

**Functions to implement**:

```javascript
/**
 * Normalize email address to consistent format
 * @param {String} email - Email address
 * @returns {String} Normalized email address
 */
function normalizeEmailAddress(email) {
  return email.toLowerCase().trim();
}

/**
 * Strip email signatures and thread history
 * @param {String} emailBody - Full email body
 * @returns {String} Cleaned email body
 */
function stripEmailSignatures(emailBody) {
  // Common signature patterns
  const signaturePatterns = [
    /--\s*$/m, // Standard signature delimiter
    /--\s*$/gm, // Multi-line signature
    /___/m, // Underscore signature
    /Best regards,?/i, // Common closing
    /Regards,?/i, // Common closing
    /Sincerely,?/i, // Common closing
    /Thanks,?/i, // Common closing
    /Thank you,?/i, // Common closing
    /Sent from my (iPhone|Android|BlackBerry)/i, // Mobile signatures
    /On .* wrote:/m, // Thread history marker
    /-----Original Message-----/m, // Thread history
    /From:.*\nSent:.*\nTo:.*\nSubject:/m, // Email headers
  ];

  let cleaned = emailBody;

  // Remove signatures and thread history
  for (const pattern of signaturePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      cleaned = cleaned.substring(0, match.index).trim();
      break;
    }
  }

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Build unrecognized sender email message
 * @returns {String} Friendly error message
 */
function buildUnrecognizedEmailMessage() {
  return `Hello!

I'm Alice, your AI property manager. I don't recognize your email address.

If you're a tenant, please contact your property manager to update your email address in our system.

Best regards,
Alice - AI Property Manager`;
}

/**
 * Build email response from AI response
 * @param {String} aiResponse - AI response text
 * @returns {String} Formatted email body
 */
function buildEmailResponse(aiResponse) {
  return `${aiResponse}

---
Best regards,
Alice - AI Property Manager

If you need immediate assistance, please contact your property manager directly.`;
}

module.exports = {
  normalizeEmailAddress,
  stripEmailSignatures,
  buildUnrecognizedEmailMessage,
  buildEmailResponse,
};
```

**Validation**: Test with various email formats and signatures

---

### 4. Handle Email Attachments

**File**: Create `src/utils/attachmentHandler.js`

**Implementation**:

```javascript
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

/**
 * Handle email attachments (photos of maintenance issues)
 * @param {Array} attachments - Array of attachment objects from Resend
 * @param {Number} conversationId - Conversation ID
 */
async function handleEmailAttachments(attachments, conversationId) {
  const uploadsDir = path.join(__dirname, "../../public/attachments");

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const savedAttachments = [];

  for (const attachment of attachments) {
    try {
      // Only process image attachments
      if (!attachment.content_type.startsWith("image/")) {
        console.log(`Skipping non-image attachment: ${attachment.filename}`);
        continue;
      }

      // Generate unique filename
      const fileExtension = path.extname(attachment.filename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      // Save attachment to disk
      const buffer = Buffer.from(attachment.content, "base64");
      fs.writeFileSync(filePath, buffer);

      console.log(`Saved attachment: ${uniqueFilename}`);

      // Store attachment metadata in database
      // Note: You may need to create an attachments table
      savedAttachments.push({
        conversation_id: conversationId,
        filename: attachment.filename,
        stored_filename: uniqueFilename,
        content_type: attachment.content_type,
        size: buffer.length,
        url: `/attachments/${uniqueFilename}`,
      });
    } catch (error) {
      console.error(`Failed to save attachment ${attachment.filename}:`, error);
    }
  }

  // If attachments table exists, save metadata
  if (savedAttachments.length > 0) {
    // TODO: Implement database insertion for attachments
    // await db.query(
    //   "INSERT INTO attachments (conversation_id, filename, stored_filename, content_type, size, url) VALUES ...",
    //   savedAttachments
    // );
  }

  return savedAttachments;
}

module.exports = {
  handleEmailAttachments,
};
```

**Optional**: Create database migration for attachments table

**File**: `database/migrations/004_add_attachments_table.sql`

```sql
-- Attachments table for email attachments (photos of issues)
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON attachments(conversation_id);
```

**Validation**: Test sending email with photo attachment

---

### 5. Update Resend Configuration for Inbound

**File**: [`src/config/resend.js`](src/config/resend.js:1)

**Additions**:

```javascript
/**
 * Verify Resend webhook signature (optional but recommended)
 * @param {String} signature - X-Resend-Signature header
 * @param {String} payload - Request body
 * @returns {Boolean} True if signature is valid
 */
function verifyWebhookSignature(signature, payload) {
  if (!process.env.RESEND_INBOUND_WEBHOOK_SECRET) {
    console.warn("Webhook signature verification disabled");
    return true;
  }

  // Implementation depends on Resend's signature method
  // Check Resend documentation for exact implementation
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RESEND_INBOUND_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

module.exports = {
  resend,
  sendEmail,
  verifyWebhookSignature, // Add this export
};
```

---

### 6. Add Webhook Signature Verification Middleware

**File**: Create `src/middleware/webhookAuth.js`

```javascript
const resend = require("../config/resend");

/**
 * Verify Resend webhook signature
 */
function verifyResendWebhook(req, res, next) {
  const signature = req.headers["x-resend-signature"];

  if (!signature) {
    console.warn("Missing Resend webhook signature");
    // Allow request but log warning
    return next();
  }

  const isValid = resend.verifyWebhookSignature(
    signature,
    JSON.stringify(req.body),
  );

  if (!isValid) {
    console.error("Invalid Resend webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  next();
}

module.exports = verifyResendWebhook;
```

**Apply to webhook route** in [`server.js`](server.js:1):

```javascript
const verifyResendWebhook = require("./src/middleware/webhookAuth");

// Apply to email webhook
app.use("/webhooks/email/inbound", verifyResendWebhook);
```

---

### 7. Update Dashboard to Show Email Channel

**Files**: Dashboard conversation pages

**Changes needed**:

1. Update conversation list to show email icon
2. Update conversation detail to display email subject
3. Add link to view attachments (if any)
4. Show email address in tenant info

**Example TypeScript type update** in [`dashboard/src/types/index.ts`](dashboard/src/types/index.ts:1):

```typescript
export interface Conversation {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  channel: "sms" | "email" | "whatsapp";
  message: string;
  response: string;
  response_display?: string;
  ai_actions?: any;
  timestamp: string;
  flagged?: boolean;
  subject?: string; // Add for emails
  attachments?: Attachment[]; // Add for emails
}

export interface Attachment {
  id: number;
  filename: string;
  stored_filename: string;
  content_type: string;
  size: number;
  url: string;
  created_at: string;
}
```

---

## Testing Plan

### Unit Tests

1. **Email Parsing Tests**
   - Test email normalization (uppercase, spaces)
   - Test signature stripping (various formats)
   - Test thread history removal

2. **Tenant Lookup Tests**
   - Test with exact email match
   - Test with case-insensitive match
   - Test with unrecognized email

### Integration Tests

1. **End-to-End Email Flow**
   - Send test email to inbound address
   - Verify webhook receives email
   - Verify tenant lookup works
   - Verify AI generates response
   - Verify response email is sent
   - Verify conversation is logged

2. **Attachment Handling**
   - Send email with photo attachment
   - Verify attachment is saved
   - Verify attachment URL is accessible
   - Verify metadata is stored

3. **Error Handling**
   - Test with missing required fields
   - Test with invalid email format
   - Test with unrecognized sender
   - Test with AI service failure

### Manual Testing

1. **Test Scenarios**
   - Tenant sends maintenance request via email
   - Tenant asks property question via email
   - Tenant sends email with photo of issue
   - Tenant sends email with long thread history
   - Tenant sends email with signature

2. **Dashboard Verification**
   - Verify email conversations appear in dashboard
   - Verify email subject is displayed
   - Verify attachments are visible
   - Verify email icon is shown

---

## Security Considerations

1. **Webhook Signature Verification**
   - Always verify Resend webhook signatures
   - Reject requests with invalid signatures
   - Log verification failures for monitoring

2. **Email Validation**
   - Validate email format before processing
   - Sanitize email content to prevent XSS
   - Rate limit email processing per sender

3. **Attachment Security**
   - Only process allowed file types (images)
   - Validate file size limits
   - Scan attachments for malware (optional)
   - Store attachments outside web root with proper access controls

4. **Data Privacy**
   - Never log full email bodies (log metadata only)
   - Encrypt sensitive attachments at rest
   - Implement data retention policy for attachments

---

## Performance Optimization

1. **Async Processing**
   - Send email responses asynchronously
   - Process attachments in background
   - Don't block webhook response

2. **Caching**
   - Cache tenant lookups
   - Cache property information
   - Cache AI responses for common queries

3. **Database Optimization**
   - Add indexes on email column in tenants table
   - Add indexes on conversation_id in attachments table
   - Archive old email attachments periodically

---

## Rollback Plan

If issues arise during implementation:

1. **Disable Email Webhook**
   - Remove webhook route or comment out
   - SMS continues to work normally

2. **Fallback to SMS Only**
   - Revert email-specific changes
   - Keep existing SMS functionality intact

3. **Database Rollback**
   - If attachments table causes issues:
     ```bash
     psql -U postgres -d property_manager -f database/migrations/rollback_004.sql
     ```

---

## Success Criteria

Step 13 is complete when:

- [ ] Resend inbound email is configured and receiving emails
- [ ] POST /webhooks/email/inbound endpoint is implemented and working
- [ ] Email parsing correctly extracts from, subject, and body
- [ ] Email signatures and thread history are stripped
- [ ] Tenant lookup by email address works correctly
- [ ] AI generates contextual responses to emails
- [ ] Email responses are sent via Resend
- [ ] Email attachments (photos) are saved and accessible
- [ ] Conversations are logged with 'email' channel
- [ ] Dashboard displays email conversations correctly
- [ ] All tests pass (unit, integration, manual)
- [ ] Error handling is robust and logged
- [ ] Security measures are implemented (webhook verification, attachment validation)
- [ ] Documentation is complete

---

## Next Steps After Completion

Once Step 13 is complete:

1. **Step 14**: Implement comprehensive notification system
   - Daily summary emails
   - Notification preferences
   - Notification history

2. **Step 15**: Build analytics dashboard
   - Track email vs SMS usage
   - Measure response times
   - Visualize metrics

3. **Testing**: Conduct beta testing with real users
   - Get feedback on email experience
   - Monitor for edge cases
   - Iterate on improvements

---

## Estimated Time

- **Setup & Configuration**: 2-3 hours
- **Email Webhook Implementation**: 4-6 hours
- **Email Parsing Utilities**: 2-3 hours
- **Attachment Handling**: 3-4 hours
- **Dashboard Updates**: 2-3 hours
- **Testing**: 4-6 hours
- **Documentation**: 1-2 hours

**Total**: 18-27 hours

---

## Dependencies

- **Resend Inbound Email** - Must be configured in Resend dashboard
- **Domain** - Must have verified domain for inbound emails
- **Storage** - Disk space for email attachments
- **Database Migration** - May need to run migration 004 for attachments table

---

## Notes

- Email communication is more complex than SMS due to attachments and threading
- Start with basic email support, then add advanced features
- Monitor email delivery rates and spam scores
- Consider implementing DKIM/SPF records for better deliverability
- Test with various email clients (Gmail, Outlook, Apple Mail)
