const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log("Starting database initialization...");

    // Read and execute migration file
    const migrationPath = path.join(__dirname, "../database/migrations/001_create_tables.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    await client.query(migrationSQL);

    console.log("✓ Database tables created successfully");

    // Create admin user with hashed password (admin123)
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = $2, name = $3`,
      ["admin@example.com", hashedPassword, "Admin User"]
    );

    console.log("✓ Admin user created/updated");
    console.log("\nDefault credentials:");
    console.log("  Email: admin@example.com");
    console.log("  Password: admin123");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase()
  .then(() => {
    console.log("\n✓ Database initialization complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Database initialization failed!");
    process.exit(1);
  });
