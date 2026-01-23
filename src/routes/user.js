const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const router = express.Router();

// Validation helpers
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return re.test(password);
};

// Get current user profile
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      "SELECT id, email, name, phone, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Update user profile
router.put("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone } = req.body;

    // Validate inputs
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      return res
        .status(400)
        .json({ error: "Name must be between 2 and 100 characters" });
    }

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (phone && phone.trim().length > 20) {
      return res
        .status(400)
        .json({ error: "Phone number is too long" });
    }

    // Check if email is already taken by another user
    const emailCheck = await db.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email.trim(), userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Update user profile
    const result = await db.query(
      `UPDATE users 
       SET name = $1, email = $2, phone = $3 
       WHERE id = $4 
       RETURNING id, email, name, phone, created_at`,
      [name.trim(), email.trim(), phone ? phone.trim() : null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✓ User profile updated: ${email}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change password
router.put("/password", async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    // Validate inputs
    if (!current_password || !new_password || !confirm_password) {
      return res
        .status(400)
        .json({ error: "All password fields are required" });
    }

    if (new_password !== confirm_password) {
      return res
        .status(400)
        .json({ error: "New passwords do not match" });
    }

    if (!validatePassword(new_password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters with uppercase, lowercase, and numbers",
      });
    }

    // Get current user
    const userResult = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(
      current_password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newPasswordHash, userId]
    );

    console.log(`✓ Password changed for user: ${user.email}`);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

module.exports = router;
