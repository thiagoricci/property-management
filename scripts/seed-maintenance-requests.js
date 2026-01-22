const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedMaintenanceRequests() {
  const client = await pool.connect();

  try {
    console.log("Starting maintenance request seeding...\n");

    // Get existing property or create one
    let propertyResult = await client.query(
      `SELECT * FROM properties LIMIT 1`
    );

    let property;
    if (propertyResult.rows.length === 0) {
      propertyResult = await client.query(
        `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules)
           VALUES ($1, $2, $3, $4, $5, $6)
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
      property = propertyResult.rows[0];
      console.log(`✓ Created property: ${property.address}`);
    } else {
      property = propertyResult.rows[0];
      console.log(`✓ Using existing property: ${property.address}`);
    }

    // Create multiple tenants
    const tenants = [
      {
        name: "Alice Johnson",
        phone: "+1-555-0202",
        email: "alice.johnson@example.com",
        lease_terms: { monthly_rent: 2500, lease_start: "2024-01-01", lease_end: "2024-12-31", security_deposit: 2500 },
        move_in_date: "2024-01-01"
      },
      {
        name: "Bob Martinez",
        phone: "+1-555-0203",
        email: "bob.martinez@example.com",
        lease_terms: { monthly_rent: 2800, lease_start: "2024-02-01", lease_end: "2024-12-31", security_deposit: 2800 },
        move_in_date: "2024-02-01"
      },
      {
        name: "Carol Williams",
        phone: "+1-555-0204",
        email: "carol.williams@example.com",
        lease_terms: { monthly_rent: 2300, lease_start: "2024-03-01", lease_end: "2024-12-31", security_deposit: 2300 },
        move_in_date: "2024-03-01"
      }
    ];

    const tenantIds = [];
    for (const tenantData of tenants) {
      const tenantResult = await client.query(
        `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
           RETURNING *`,
        [property.id, tenantData.name, tenantData.phone, tenantData.email, JSON.stringify(tenantData.lease_terms), tenantData.move_in_date]
      );
      const tenant = tenantResult.rows[0];
      tenantIds.push(tenant.id);
      console.log(`✓ Created/updated tenant: ${tenant.name} (ID: ${tenant.id})`);
    }

    // Create maintenance requests with various priorities and statuses
    const maintenanceRequests = [
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        issue_description: "Burst pipe causing flooding in bathroom",
        priority: "emergency",
        status: "open",
        notes: "Emergency - Immediate action required. Tenant notified to turn off main water valve.",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        issue_description: "Strong gas smell in kitchen",
        priority: "emergency",
        status: "open",
        notes: "Emergency - Tenant evacuated. 911 called.",
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        issue_description: "Heating system not working",
        priority: "urgent",
        status: "open",
        notes: "Urgent - HVAC technician needed ASAP",
        created_at: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        issue_description: "No water supply to apartment",
        priority: "urgent",
        status: "in_progress",
        notes: "Building management contacted",
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        issue_description: "Leaky kitchen faucet",
        priority: "normal",
        status: "open",
        notes: "Plumber to be scheduled",
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        issue_description: "Flickering hallway light fixture",
        priority: "normal",
        status: "open",
        notes: "Electrician to inspect wiring",
        created_at: new Date(Date.now() - 36 * 60 * 60 * 1000) // 1.5 days ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        issue_description: "Minor paint touch-ups needed on walls",
        priority: "low",
        status: "open",
        notes: "Schedule during next maintenance window",
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        issue_description: "Loose kitchen cabinet door",
        priority: "low",
        status: "open",
        notes: "Tighten hinges during routine visit",
        created_at: new Date(Date.now() - 72 * 60 * 60 * 1000) // 3 days ago
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        issue_description: "Broken window lock in bedroom",
        priority: "urgent",
        status: "resolved",
        notes: "Lock replaced on 2026-01-20",
        created_at: new Date(Date.now() - 96 * 60 * 60 * 1000),
        resolved_at: new Date(Date.now() - 90 * 60 * 60 * 1000) // 4 days ago, resolved
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        issue_description: "AC unit not cooling properly",
        priority: "normal",
        status: "in_progress",
        notes: "Technician scheduled for tomorrow",
        created_at: new Date(Date.now() - 120 * 60 * 60 * 1000) // 5 days ago
      }
    ];

    for (const mr of maintenanceRequests) {
      const result = await client.query(
        `INSERT INTO maintenance_requests (property_id, tenant_id, issue_description, priority, status, notes, created_at${mr.resolved_at ? ', resolved_at' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7${mr.resolved_at ? ', $8' : ''})`,
        mr.resolved_at 
          ? [mr.property_id, mr.tenant_id, mr.issue_description, mr.priority, mr.status, mr.notes, mr.created_at, mr.resolved_at]
          : [mr.property_id, mr.tenant_id, mr.issue_description, mr.priority, mr.status, mr.notes, mr.created_at]
      );
      console.log(`✓ Created maintenance request: ${mr.priority.toUpperCase()} - ${mr.issue_description.substring(0, 40)}...`);
    }

    console.log("\n✓ Maintenance request seeding complete!");
    console.log("\nSummary:");
    console.log(`  Properties: 1`);
    console.log(`  Tenants: ${tenants.length}`);
    console.log(`  Maintenance Requests: ${maintenanceRequests.length}`);
    console.log(`  Emergency Requests: 2`);
    console.log(`  Urgent Requests: 3`);
    console.log(`  Normal Requests: 3`);
    console.log(`  Low Requests: 2`);
    console.log(`  Open: 7`);
    console.log(`  In Progress: 2`);
    console.log(`  Resolved: 1`);

  } catch (error) {
    console.error("Maintenance request seeding error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMaintenanceRequests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Maintenance request seeding failed!");
    process.exit(1);
  });
