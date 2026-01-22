const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyConversationThreads() {
  const client = await pool.connect();

  try {
    console.log("Verifying conversation threads data...\n");

    // Verify tenants
    const tenantsResult = await client.query(
      `SELECT id, name, phone, email FROM tenants WHERE id IN (5, 6, 7) ORDER BY id`
    );
    console.log("=== Tenants ===");
    for (const tenant of tenantsResult.rows) {
      console.log(`  ${tenant.id}: ${tenant.name} (${tenant.phone})`);
    }

    // Verify conversations per tenant
    console.log("\n=== Conversations Per Tenant ===");
    for (const tenant of tenantsResult.rows) {
      const convResult = await client.query(
        `SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1`,
        [tenant.id]
      );
      console.log(`  ${tenant.name}: ${convResult.rows[0].count} messages`);
    }

    // Verify conversation details
    console.log("\n=== Conversation Samples ===");
    const sampleConversations = await client.query(
      `SELECT c.id, t.name as tenant_name, c.channel,
              SUBSTRING(c.message, 1, 50) as message_preview,
              c.flagged
       FROM conversations c
       JOIN tenants t ON c.tenant_id = t.id
       WHERE c.tenant_id IN (5, 6, 7)
       ORDER BY c.id
       LIMIT 6`
    );
    for (const conv of sampleConversations.rows) {
      const flagged = conv.flagged ? ' [FLAGGED]' : '';
      console.log(`  ID ${conv.id}: ${conv.tenant_name} - ${conv.message_preview}...${flagged}`);
    }

    // Verify maintenance requests
    console.log("\n=== Maintenance Requests ===");
    const mrResult = await client.query(
      `SELECT mr.id, t.name as tenant_name, mr.priority, mr.status,
              SUBSTRING(mr.issue_description, 1, 50) as issue_preview
       FROM maintenance_requests mr
       JOIN tenants t ON mr.tenant_id = t.id
       WHERE mr.tenant_id IN (5, 6, 7)
       ORDER BY mr.id`
    );
    for (const mr of mrResult.rows) {
      console.log(`  ${mr.id}: ${mr.tenant_name} - ${mr.priority.toUpperCase()} - ${mr.issue_preview}... (${mr.status})`);
    }

    // Count total records
    const totalMessages = await client.query(
      `SELECT COUNT(*) as count FROM conversations WHERE tenant_id IN (5, 6, 7)`
    );
    const totalMR = await client.query(
      `SELECT COUNT(*) as count FROM maintenance_requests WHERE tenant_id IN (5, 6, 7)`
    );

    console.log("\n=== Summary ===");
    console.log(`  Total Tenants: ${tenantsResult.rows.length}`);
    console.log(`  Total Messages: ${totalMessages.rows[0].count}`);
    console.log(`  Messages per Tenant: ${totalMessages.rows[0].count / tenantsResult.rows.length}`);
    console.log(`  Total Maintenance Requests: ${totalMR.rows[0].count}`);
    console.log(`  Expected: 3 tenants, 30 messages, 3 maintenance requests`);

    const expectedTenants = 3;
    const expectedMessages = 30;
    const expectedMR = 3;

    if (tenantsResult.rows.length === expectedTenants &&
        parseInt(totalMessages.rows[0].count) === expectedMessages &&
        parseInt(totalMR.rows[0].count) === expectedMR) {
      console.log("\n✓ All data verified successfully!");
    } else {
      console.log("\n✗ Data verification failed!");
      console.log(`  Expected ${expectedTenants} tenants, got ${tenantsResult.rows.length}`);
      console.log(`  Expected ${expectedMessages} messages, got ${totalMessages.rows[0].count}`);
      console.log(`  Expected ${expectedMR} maintenance requests, got ${totalMR.rows[0].count}`);
    }

  } catch (error) {
    console.error("Verification error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyConversationThreads()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Verification failed!");
    process.exit(1);
  });
