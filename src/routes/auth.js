const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  console.log('✓ Auth test endpoint called');
  res.json({ message: "Auth routes are working!" });
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    const { email, password } = req.body;

    console.log('Email:', email);
    console.log('Password provided:', !!password);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    // Find user by email
    console.log('🔍 Querying database for user...');
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log('Found users:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    console.log('✓ User found:', user.email);

    // Compare password
    console.log('🔐 Comparing password...');
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log('✓ Password valid');

    // Generate JWT token
    console.log('🔑 Generating JWT token...');
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    console.log('✓ Token generated successfully');

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout endpoint (client-side mainly, but we can add server-side logic if needed)
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
