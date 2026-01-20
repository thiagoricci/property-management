const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Starting migration: Add 'api' channel to conversations table...");

    // Drop existing constraint
    await client.query(
      "ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check"
    );
    console.log("✓ Dropped existing constraint");

    // Add new constraint with 'api' included
    await client.query(
      `ALTER TABLE conversations 
       ADD CONSTRAINT conversations_channel_check 
       CHECK (channel IN ('sms', 'email', 'whatsapp', 'api'))`
    );
    console.log("✓ Added new constraint with 'api' channel");

    console.log("\n✓ Migration complete!");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Migration failed!");
    process.exit(1);
  });
