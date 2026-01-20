const twilio = require("twilio");

/**
 * Twilio client configuration
 * Handles SMS sending and receiving
 */

// Validate required environment variables
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.warn("WARNING: Twilio credentials not configured. SMS functionality will not work.");
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS message via Twilio
 * @param {String} to - Recipient phone number (E.164 format)
 * @param {String} body - Message content
 * @returns {Promise<Object>} Twilio message object
 */
async function sendSMS(to, body) {
  try {
    const message = await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });

    console.log(`SMS sent to ${to}: Message SID ${message.sid}`);
    return message;
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Validate Twilio webhook signature
 * @param {String} url - The full URL of the webhook
 * @param {Object} params - The request parameters
 * @param {String} signature - The X-Twilio-Signature header value
 * @returns {Boolean} True if signature is valid
 */
function validateWebhookSignature(url, params, signature) {
  try {
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    );
  } catch (error) {
    console.error("Webhook signature validation error:", error);
    return false;
  }
}

module.exports = {
  client,
  sendSMS,
  validateWebhookSignature,
};
