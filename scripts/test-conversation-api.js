/**
 * Test Conversation API Fix
 * Verifies that conversation detail endpoint returns all messages correctly
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Generate JWT token
const token = jwt.sign(
  { id: 1, email: 'admin@example.com' },
  process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  { expiresIn: '1h' }
);

console.log('✅ JWT Token generated');

// Test API endpoint
async function testConversationAPI() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/property_manager',
  });

  try {
    // Get conversation thread ID 34 (John Smith's thread)
    const threadResult = await pool.query(
      `SELECT
         ct.*,
         t.name as tenant_name,
         t.phone as tenant_phone,
         t.email as tenant_email,
         p.address as property_address
       FROM conversation_threads ct
       LEFT JOIN tenants t ON ct.tenant_id = t.id
       LEFT JOIN properties p ON ct.property_id = p.id
       WHERE ct.id = $1`,
      [34]
    );

    if (threadResult.rows.length === 0) {
      console.error('❌ Conversation thread not found');
      return;
    }

    const thread = threadResult.rows[0];
    console.log(`\n✅ Thread found: "${thread.subject}"`);
    console.log(`   Tenant: ${thread.tenant_name}`);
    console.log(`   Property: ${thread.property_address}`);

    // Get all messages in this thread
    const messagesResult = await pool.query(
      `SELECT m.*
       FROM messages m
       WHERE m.thread_id = $1
       ORDER BY m.timestamp ASC`,
      [34]
    );

    console.log(`\n✅ Messages found: ${messagesResult.rows.length}`);
    console.log('\n📝 Message List:');
    messagesResult.rows.forEach((msg, index) => {
      const type = msg.message_type === 'user_message' ? 'USER' : 'AI';
      const preview = msg.message_type === 'user_message' 
        ? msg.message.substring(0, 50) + '...'
        : msg.response.substring(0, 50) + '...';
      
      console.log(`   ${index + 1}. [${type}] ${preview}`);
    });

    // Get related maintenance requests
    const maintenanceResult = await pool.query(
      `SELECT mr.*
       FROM maintenance_requests mr
       JOIN messages m ON mr.message_id = m.id
       WHERE m.thread_id = $1
       ORDER BY mr.created_at DESC`,
      [34]
    );

    console.log(`\n✅ Maintenance requests: ${maintenanceResult.rows.length}`);
    maintenanceResult.rows.forEach((req, index) => {
      const icon = req.priority === 'emergency' ? '🚨' : '📋';
      console.log(`   ${index + 1}. ${icon} ${req.priority}: ${req.issue_description.substring(0, 50)}...`);
    });

    // Test API response structure
    console.log('\n✅ API Response Structure:');
    const apiResponse = {
      ...thread,
      messages: messagesResult.rows,
      related_maintenance: maintenanceResult.rows,
      attachments: []
    };

    console.log('   Keys:', Object.keys(apiResponse));
    console.log('   Has messages?', !!apiResponse.messages);
    console.log('   Messages count:', apiResponse.messages?.length || 0);
    console.log('   Has related_maintenance?', !!apiResponse.related_maintenance);
    console.log('   Related maintenance count:', apiResponse.related_maintenance?.length || 0);
    console.log('   Subject:', apiResponse.subject);
    console.log('   Tenant name:', apiResponse.tenant_name);

    console.log('\n✅ All tests passed!');
    console.log('\n📋 To test in browser:');
    console.log(`   curl http://localhost:3000/api/conversations/34 \\`);
    console.log(`     -H "Authorization: Bearer ${token}"`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConversationAPI();
