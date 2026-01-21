const { Pool } = require('pg');
require('dotenv').config();

async function testDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Testing database connection...\n');

    // Test connection
    const client = await pool.connect();
    console.log('✓ Connected to database');

    // Check if users table exists
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    `);

    if (tablesResult.rows.length === 0) {
      console.log('❌ Users table does not exist!');
      return;
    }

    console.log('✓ Users table exists');

    // Check for admin user
    const userResult = await client.query(
      'SELECT id, email, password_hash, name FROM users WHERE email = $1',
      ['admin@example.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✓ Found admin user:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Password Hash: ${user.password_hash.substring(0, 20)}...`);

    // Test password verification
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare('admin123', user.password_hash);

    if (isValid) {
      console.log('\n✅ Password verification successful!');
    } else {
      console.log('\n❌ Password verification failed!');
    }

  } catch (error) {
    console.error('\n❌ Database test error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testDatabase();
