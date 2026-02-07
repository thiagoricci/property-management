const bcrypt = require("bcryptjs");
require("dotenv").config();
const db = require("../src/config/database");

async function createAdminUser() {
  try {
    console.log("👤 Create Admin User\n");

    const email = process.argv[2] || "admin@example.com";
    const password = process.argv[3] || "admin123";
    const name = process.argv[4] || "Admin User";

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Name: ${name}\n`);

    // Check if user already exists
    const existingUser = await db.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log("⚠️  User already exists!");
      console.log(`   ID: ${existingUser.rows[0].id}`);
      console.log(`   Email: ${existingUser.rows[0].email}\n`);

      const reset = await promptReset();
      if (reset) {
        console.log("\n🔄 Resetting password...");
        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [passwordHash, existingUser.rows[0].id]
        );
        console.log("✓ Password reset successfully!");
      } else {
        console.log("❌ Aborted.");
        process.exit(0);
      }
    } else {
      // Hash password
      console.log("🔒 Hashing password...");
      const passwordHash = await bcrypt.hash(password, 10);
      console.log("✓ Password hashed\n");

      // Insert user
      console.log("💾 Creating user in database...");
      const result = await db.query(
        "INSERT INTO users (email, password_hash, name, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, name",
        [email, passwordHash, name]
      );

      const user = result.rows[0];
      console.log("✓ User created successfully!\n");

      console.log("─────────────────────────────────────");
      console.log("✅ ADMIN USER CREATED");
      console.log("─────────────────────────────────────");
      console.log(`ID:       ${user.id}`);
      console.log(`Email:    ${user.email}`);
      console.log(`Name:     ${user.name}`);
      console.log(`Password: ${password}`);
      console.log("─────────────────────────────────────");
      console.log("\n🎉 You can now log in with these credentials!");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function promptReset() {
  // Simple approach - always reset if user exists
  // In production, you might want to use readline for interactive prompts
  return true;
}

createAdminUser();
