const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

async function testAuthDirectly() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔐 Testing auth flow directly...\n');

    const email = 'admin@example.com';
    const password = 'admin123';

    // Find user by email
    console.log('🔍 Querying database for user...');
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log('Found users:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = result.rows[0];
    console.log('✓ User found:', user.email);

    // Compare password
    console.log('🔐 Comparing password...');
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      console.log('❌ Invalid password');
      return;
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
    console.log('\n✅ Auth flow successful!');
    console.log('Token:', token.substring(0, 50) + '...');

  } catch (error) {
    console.error('\n❌ Auth test error:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testAuthDirectly();
