const bcrypt = require("bcryptjs");
require("dotenv").config();
const db = require("../src/config/database");

async function resetPassword() {
  try {
    console.log("🔐 Password Reset Utility\n");

    // Get email from command line or use default
    const email = process.argv[2] || "admin@example.com";
    const newPassword = process.argv[3] || "admin123";

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 New Password: ${newPassword}\n`);

    // Check if user exists
    const result = await db.query(
      "SELECT id, email, name FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      console.log("❌ User not found!");
      console.log("\n💡 Usage: node scripts/reset-password.js [email] [new-password]");
      console.log("   Example: node scripts/reset-password.js admin@example.com newpass123");
      process.exit(1);
    }

    const user = result.rows[0];
    console.log(`✓ User found: ${user.name} (${user.email})\n`);

    // Hash the new password
    console.log("🔒 Hashing password...");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log("✓ Password hashed\n");

    // Update password in database
    console.log("💾 Updating password in database...");
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, user.id]
    );
    console.log("✓ Password updated successfully!\n");

    console.log("─────────────────────────────────────");
    console.log("✅ PASSWORD RESET COMPLETE");
    console.log("─────────────────────────────────────");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log("─────────────────────────────────────");
    console.log("\n🎉 You can now log in with these credentials!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetPassword();
