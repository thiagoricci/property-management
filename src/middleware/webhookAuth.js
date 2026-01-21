/**
 * Webhook authentication middleware
 * Verifies signatures from external services (Resend, Twilio)
 */

const resend = require("../config/resend");

/**
 * Verify Resend webhook signature
 * Checks the X-Resend-Signature header to ensure the request
 * is actually from Resend and not tampered with.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyResendWebhook(req, res, next) {
  const signature = req.headers["x-resend-signature"];

  if (!signature) {
    console.warn("Missing Resend webhook signature");
    // Allow request but log warning (for development)
    if (process.env.NODE_ENV === "development") {
      return next();
    }
    return res.status(401).json({ error: "Missing signature" });
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

/**
 * Verify Twilio webhook signature
 * Checks the X-Twilio-Signature header to ensure the request
 * is actually from Twilio and not tampered with.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyTwilioWebhook(req, res, next) {
  // Twilio signature verification would go here
  // For now, we'll allow requests but log a warning
  // TODO: Implement proper Twilio signature verification

  const signature = req.headers["x-twilio-signature"];

  if (!signature) {
    console.warn("Missing Twilio webhook signature");
    if (process.env.NODE_ENV === "development") {
      return next();
    }
    return res.status(401).json({ error: "Missing signature" });
  }

  // Allow for now - implement proper verification later
  next();
}

/**
 * Generic webhook authentication middleware
 * Routes can specify which service they expect
 *
 * @param {String} service - Service name ('resend' or 'twilio')
 * @returns {Function} Express middleware function
 */
function verifyWebhook(service) {
  return (req, res, next) => {
    if (service === "resend") {
      return verifyResendWebhook(req, res, next);
    } else if (service === "twilio") {
      return verifyTwilioWebhook(req, res, next);
    } else {
      console.error(`Unknown webhook service: ${service}`);
      return res.status(400).json({ error: "Unknown service" });
    }
  };
}

module.exports = {
  verifyResendWebhook,
  verifyTwilioWebhook,
  verifyWebhook,
};
