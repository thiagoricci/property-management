const express = require("express");
const db = require("../config/database");
const { encrypt, decrypt, mask } = require("../utils/encryption");
const twilio = require("twilio");
const router = express.Router();

// Validation helpers
const validateTwilioAccountSid = (sid) => {
  return /^AC[a-f0-9]{32}$/.test(sid);
};

const validateTwilioAuthToken = (token) => {
  return token && token.length >= 32;
};

const validateTwilioPhoneNumber = (phone) => {
  return /^\+?[1-9]\d{1,14}$/.test(phone);
};

// Get Twilio configuration
router.get("/twilio", async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      "SELECT twilio_account_sid, twilio_phone_number FROM user_settings WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        twilio_account_sid: null,
        twilio_phone_number: null,
        configured: false,
      });
    }

    const settings = result.rows[0];
    res.json({
      twilio_account_sid: settings.twilio_account_sid,
      twilio_phone_number: settings.twilio_phone_number,
      configured: !!settings.twilio_account_sid && !!settings.twilio_phone_number,
    });
  } catch (error) {
    console.error("Get Twilio settings error:", error);
    res.status(500).json({ error: "Failed to fetch Twilio settings" });
  }
});

// Update Twilio configuration
router.put("/twilio", async (req, res) => {
  try {
    const userId = req.user.id;
    const { account_sid, auth_token, phone_number } = req.body;

    // Validate inputs
    if (!account_sid || !validateTwilioAccountSid(account_sid)) {
      return res
        .status(400)
        .json({ error: "Invalid Twilio Account SID format" });
    }

    if (!auth_token || !validateTwilioAuthToken(auth_token)) {
      return res
        .status(400)
        .json({ error: "Invalid Twilio Auth Token format" });
    }

    if (!phone_number || !validateTwilioPhoneNumber(phone_number)) {
      return res
        .status(400)
        .json({ error: "Invalid phone number format. Use E.164 format (e.g., +1234567890)" });
    }

    // Encrypt auth token
    const encryptedToken = encrypt(auth_token);

    // Upsert settings
    const result = await db.query(
      `INSERT INTO user_settings (user_id, twilio_account_sid, twilio_auth_token_encrypted, twilio_phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         twilio_account_sid = EXCLUDED.twilio_account_sid,
         twilio_auth_token_encrypted = EXCLUDED.twilio_auth_token_encrypted,
         twilio_phone_number = EXCLUDED.twilio_phone_number,
         updated_at = NOW()
       RETURNING twilio_account_sid, twilio_phone_number`,
      [userId, account_sid, encryptedToken, phone_number]
    );

    console.log(`✓ Twilio configuration updated for user: ${userId}`);
    res.json({
      success: true,
      message: "Twilio configuration saved successfully",
      twilio_account_sid: result.rows[0].twilio_account_sid,
      twilio_phone_number: result.rows[0].twilio_phone_number,
    });
  } catch (error) {
    console.error("Update Twilio settings error:", error);
    res.status(500).json({ error: "Failed to save Twilio settings" });
  }
});

// Test Twilio connection
router.post("/twilio/test", async (req, res) => {
  try {
    const { account_sid, auth_token, phone_number } = req.body;

    // Validate inputs
    if (!account_sid || !validateTwilioAccountSid(account_sid)) {
      return res
        .status(400)
        .json({ error: "Invalid Twilio Account SID format" });
    }

    if (!auth_token || !validateTwilioAuthToken(auth_token)) {
      return res
        .status(400)
        .json({ error: "Invalid Twilio Auth Token format" });
    }

    if (!phone_number || !validateTwilioPhoneNumber(phone_number)) {
      return res
        .status(400)
        .json({ error: "Invalid phone number format" });
    }

    // Create Twilio client
    const client = twilio(account_sid, auth_token);

    // Send test message
    const testMessage = await client.messages.create({
      body: "✓ Twilio configuration test successful! Your AI Property Manager is ready to send SMS notifications.",
      from: phone_number,
      to: phone_number, // Send to the configured number for testing
    });

    console.log(`✓ Twilio test message sent: ${testMessage.sid}`);
    res.json({
      success: true,
      message: "Test SMS sent successfully",
      test_message_sid: testMessage.sid,
      test_message_status: testMessage.status,
    });
  } catch (error) {
    console.error("Twilio test error:", error);

    // Provide helpful error messages
    let errorMessage = "Failed to test Twilio connection";
    
    if (error.code === 20003) {
      errorMessage = "Authentication failed - check your Account SID and Auth Token";
    } else if (error.code === 21614) {
      errorMessage = "Unreachable number - check the phone number format";
    } else if (error.code === 21211) {
      errorMessage = "Invalid 'To' phone number";
    } else if (error.code === 21612) {
      errorMessage = "Invalid 'From' phone number - must be a Twilio number";
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      code: error.code,
    });
  }
});

// Delete Twilio configuration
router.delete("/twilio", async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      "UPDATE user_settings SET twilio_account_sid = NULL, twilio_auth_token_encrypted = NULL, twilio_phone_number = NULL WHERE user_id = $1",
      [userId]
    );

    console.log(`✓ Twilio configuration deleted for user: ${userId}`);
    res.json({
      success: true,
      message: "Twilio configuration removed successfully",
    });
  } catch (error) {
    console.error("Delete Twilio settings error:", error);
    res.status(500).json({ error: "Failed to remove Twilio settings" });
  }
});

module.exports = router;
