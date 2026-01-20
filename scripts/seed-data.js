const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedData() {
  const client = await pool.connect();

  try {
    console.log("Starting data seeding...");

    // Insert sample property
    const propertyResult = await client.query(
      `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        "123 Main Street, Apt 4B, San Francisco, CA 94102",
        "John Smith",
        "john.smith@example.com",
        "+1-555-0101",
        JSON.stringify({
          wifi: "PropertyWiFi-5G",
          wifi_password: "Welcome123!",
          parking: "Street parking available",
          laundry: "Laundry room on ground floor",
          gym: "24/7 access",
          pool: "Rooftop pool, 8AM-10PM",
        }),
        JSON.stringify({
          quiet_hours: "10PM - 8AM",
          guest_policy: "Guests allowed for up to 3 nights",
          pet_policy: "No pets allowed",
          smoking_policy: "No smoking anywhere on property",
          rent_due: "1st of every month",
          maintenance_requests: "Submit via text message or email",
        }),
      ]
    );

    const property = propertyResult.rows[0];
    console.log(`✓ Created property: ${property.address}`);

    // Insert sample tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        property.id,
        "Alice Johnson",
        "+1-555-0202",
        "alice.johnson@example.com",
        JSON.stringify({
          monthly_rent: 2500,
          lease_start: "2024-01-01",
          lease_end: "2024-12-31",
          security_deposit: 2500,
        }),
        "2024-01-01",
      ]
    );

    const tenant = tenantResult.rows[0];
    console.log(`✓ Created tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Insert sample conversation
    await client.query(
      `INSERT INTO conversations (tenant_id, channel, message, response, timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        tenant.id,
        "sms",
        "Hi, I just moved in. What's the WiFi password?",
        "Welcome to your new home! The WiFi network is 'PropertyWiFi-5G' and the password is 'Welcome123!'. Let me know if you need anything else!",
      ]
    );

    console.log("✓ Created sample conversation");

    console.log("\n✓ Data seeding complete!");
    console.log("\nTest Tenant Details:");
    console.log(`  Tenant ID: ${tenant.id}`);
    console.log(`  Name: ${tenant.name}`);
    console.log(`  Property ID: ${property.id}`);
    console.log(`  Phone: ${tenant.phone}`);
  } catch (error) {
    console.error("Data seeding error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Data seeding failed!");
    process.exit(1);
  });
