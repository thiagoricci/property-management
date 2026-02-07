const twilio = require("twilio");
const { decrypt } = require("../utils/encryption");

/**
 * Twilio client configuration
 * Handles SMS sending and receiving
 *
 * Supports both legacy .env configuration and user-specific credentials from database
 */

/**
 * Create Twilio client with specific credentials
 * @param {String} accountSid - Twilio Account SID
 * @param {String} authToken - Twilio Auth Token
 * @returns {Object} Twilio client instance
 */
function createClient(accountSid, authToken) {
  return twilio(accountSid, authToken);
}

/**
 * Create Twilio client from user settings
 * @param {Object} userSettings - User settings from database
 * @returns {Object|null} Twilio client instance or null if not configured
 */
function createClientFromUserSettings(userSettings) {
  if (!userSettings || !userSettings.twilio_account_sid || !userSettings.twilio_auth_token_encrypted) {
    return null;
  }

  try {
    const authToken = decrypt(userSettings.twilio_auth_token_encrypted);
    return createClient(userSettings.twilio_account_sid, authToken);
  } catch (error) {
    console.error("Failed to create Twilio client from user settings:", error);
    return null;
  }
}

/**
 * Send SMS message via Twilio with specific credentials
 * @param {String} to - Recipient phone number (E.164 format)
 * @param {String} body - Message content
 * @param {String} fromNumber - Twilio phone number to send from
 * @param {String} accountSid - Twilio Account SID
 * @param {String} authToken - Twilio Auth Token
 * @returns {Promise<Object>} Twilio message object
 */
async function sendSMS(to, body, fromNumber, accountSid, authToken) {
  try {
    const client = createClient(accountSid, authToken);
    const message = await client.messages.create({
      body: body,
      from: fromNumber,
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
 * Send SMS message via Twilio using user settings
 * @param {String} to - Recipient phone number (E.164 format)
 * @param {String} body - Message content
 * @param {Object} userSettings - User settings from database
 * @returns {Promise<Object>} Twilio message object
 */
async function sendSMSWithUserSettings(to, body, userSettings) {
  if (!userSettings || !userSettings.twilio_account_sid || !userSettings.twilio_auth_token_encrypted || !userSettings.twilio_phone_number) {
    throw new Error("Twilio not configured in user settings");
  }

  try {
    const authToken = decrypt(userSettings.twilio_auth_token_encrypted);
    const client = createClient(userSettings.twilio_account_sid, authToken);
    const message = await client.messages.create({
      body: body,
      from: userSettings.twilio_phone_number,
      to: to,
    });

    console.log(`SMS sent to ${to}: Message SID ${message.sid}`);
    return message;
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

// Legacy support: Create default client from environment variables (for backward compatibility)
let defaultClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  defaultClient = createClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log("Twilio configured from environment variables (legacy mode)");
} else {
  console.log("Twilio credentials not configured in environment variables. Use user settings instead.");
}

/**
 * Legacy function: Send SMS using environment variables (deprecated)
 * @deprecated Use sendSMSWithUserSettings instead
 */
async function sendSMSLegacy(to, body) {
  if (!defaultClient) {
    throw new Error("Twilio not configured. Please configure in settings.");
  }

  try {
    const message = await defaultClient.messages.create({
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
  client: defaultClient,
  sendSMS,
  sendSMSLegacy,
  sendSMSWithUserSettings,
  createClient,
  createClientFromUserSettings,
  validateWebhookSignature,
};
