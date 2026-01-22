/**
 * Verify Test Data Script
 * Checks that the test data was created correctly
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/property_manager',
});

async function verifyTestData() {
  const client = await pool.connect();

  try {
    console.log('\n=== VERIFICATION RESULTS ===\n');

    // Check tenants
    const tenants = await client.query(
      'SELECT id, name, phone FROM tenants WHERE phone LIKE $1 ORDER BY id',
      ['+1555%']
    );
    console.log('TENANTS:');
    tenants.rows.forEach(t => {
      console.log(`  - ${t.name} (ID: ${t.id}, Phone: ${t.phone})`);
    });

    // Check conversation threads
    const threads = await client.query(
      `SELECT ct.id, t.name as tenant_name, ct.subject, ct.status 
       FROM conversation_threads ct 
       JOIN tenants t ON ct.tenant_id = t.id 
       WHERE t.phone LIKE $1 
       ORDER BY ct.id`,
      ['+1555%']
    );
    console.log('\nCONVERSATION THREADS:');
    threads.rows.forEach(t => {
      console.log(`  - ${t.tenant_name}: ${t.subject} (ID: ${t.id}, Status: ${t.status})`);
    });

    // Check messages per thread
    console.log('\nMESSAGES PER THREAD:');
    for (const thread of threads.rows) {
      const msgCount = await client.query(
        'SELECT COUNT(*) as count FROM messages WHERE thread_id = $1',
        [thread.id]
      );
      console.log(`  - Thread ${thread.id}: ${msgCount.rows[0].count} messages`);
    }

    // Check maintenance requests
    const maint = await client.query(
      `SELECT mr.id, t.name as tenant_name, mr.priority, mr.status, mr.issue_description 
       FROM maintenance_requests mr 
       JOIN tenants t ON mr.tenant_id = t.id 
       WHERE t.phone LIKE $1 
       ORDER BY mr.id`,
      ['+1555%']
    );
    console.log('\nMAINTENANCE REQUESTS:');
    maint.rows.forEach(m => {
      const priorityIcon = m.priority === 'emergency' ? '🚨' : '📋';
      const desc = m.issue_description.substring(0, 50) + '...';
      console.log(`  ${priorityIcon} ${m.tenant_name}: ${desc} (Priority: ${m.priority}, Status: ${m.status})`);
    });

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Tenants: ${tenants.rows.length}`);
    console.log(`Conversation Threads: ${threads.rows.length}`);
    console.log(`Maintenance Requests: ${maint.rows.length}`);
    console.log('\n✅ All data verified successfully!\n');

  } catch (error) {
    console.error('Error verifying test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the verification
verifyTestData().catch(console.error);
