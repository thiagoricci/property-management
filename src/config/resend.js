const { Resend } = require("resend");
const crypto = require("crypto");

/**
 * Resend email configuration
 * Handles email sending for manager notifications and inbound email webhooks
 */

// Validate required environment variables
if (!process.env.RESEND_API_KEY) {
  console.warn("WARNING: Resend API key not configured. Email functionality will not work.");
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

/**
 * Verify Resend webhook signature
 * @param {String} signature - X-Resend-Signature header
 * @param {String} payload - Request body as string
 * @returns {Boolean} True if signature is valid
 */
function verifyWebhookSignature(signature, payload) {
  if (!process.env.RESEND_INBOUND_WEBHOOK_SECRET) {
    console.warn("WARNING: Webhook signature verification disabled. Set RESEND_INBOUND_WEBHOOK_SECRET in .env");
    return true;
  }

  if (!signature) {
    console.error("Missing webhook signature");
    return false;
  }

  try {
    // Resend uses HMAC-SHA256 for webhook signatures
    // The signature format is: t=timestamp,v1=hash
    const signatureParts = signature.split(",");
    const timestamp = signatureParts[0].split("=")[1];
    const hash = signatureParts[1].split("=")[1];

    // Check timestamp is within 5 minutes to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const timestampAge = now - parseInt(timestamp);
    if (timestampAge > 300) {
      console.error("Webhook signature timestamp too old");
      return false;
    }

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RESEND_INBOUND_WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedSignature),
    );
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

module.exports = {
  resend,
  sendEmail,
  verifyWebhookSignature,
};
