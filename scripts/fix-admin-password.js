const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function fixAdminPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Fixing admin password hash...\n');

    // Generate proper hash for 'admin123'
    const hash = await bcrypt.hash('admin123', 10);
    console.log('✓ Generated bcrypt hash for "admin123":');
    console.log(`  ${hash}\n`);

    // Check if admin user exists
    const checkResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@example.com']
    );

    if (checkResult.rows.length === 0) {
      console.log('⚠️  Admin user not found. Creating new admin user...');
      
      await pool.query(
        `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash`,
        ['admin@example.com', hash, 'Admin User']
      );
      
      console.log('✓ Created admin user with correct password hash');
    } else {
      console.log(`✓ Found admin user (ID: ${checkResult.rows[0].id})`);
      
      // Update the password hash
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hash, 'admin@example.com']
      );
      
      console.log('✓ Updated password hash successfully');
    }

    // Verify the hash works
    const verifyResult = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['admin@example.com']
    );

    const isValid = await bcrypt.compare('admin123', verifyResult.rows[0].password_hash);
    
    if (isValid) {
      console.log('\n✅ Password verification successful!');
      console.log('   You can now login with:');
      console.log('   Email: admin@example.com');
      console.log('   Password: admin123\n');
    } else {
      console.log('\n❌ Password verification failed!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error fixing admin password:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixAdminPassword();
