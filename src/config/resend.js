const { Resend } = require("resend");

/**
 * Resend email configuration
 * Handles email sending for manager notifications
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

module.exports = {
  resend,
  sendEmail,
};
