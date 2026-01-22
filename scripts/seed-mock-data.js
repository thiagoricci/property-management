const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedMockData() {
  const client = await pool.connect();

  try {
    console.log("Starting mock data seeding...\n");

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

    // Create conversations with various issues and priorities
    const conversations = [
      // EMERGENCY - Burst pipe/flooding
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "HELP! There's water everywhere! A pipe burst in the bathroom and it's flooding the apartment!",
        response: "This is an emergency! I've immediately notified the property manager and created an emergency maintenance request. Please turn off the main water valve if you can find it, and move any valuables away from the water. Help is on the way!",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "emergency", description: "Burst pipe causing flooding in bathroom" },
          { action: "alert_manager", urgency: "immediate", reason: "Emergency: Burst pipe causing flooding" }
        ]),
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        flagged: true
      },
      // EMERGENCY - Gas leak
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "I smell gas really strongly in the kitchen! What should I do?",
        response: "This is an emergency! Please evacuate the apartment immediately and call 911. Do not use any electrical switches or open flames. I've alerted the property manager and they're contacting emergency services right away!",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "emergency", description: "Strong gas smell in kitchen" },
          { action: "alert_manager", urgency: "immediate", reason: "Emergency: Gas leak detected" }
        ]),
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        flagged: true
      },
      // URGENT - No heat in winter
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "The heating is not working and it's freezing in here. It's been off since last night.",
        response: "I'm sorry about that! This is urgent, especially in winter. I've created an urgent maintenance request for the heating system. The property manager will contact a HVAC technician today. In the meantime, please use space heaters if available and keep doors closed to retain heat.",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "urgent", description: "Heating system not working" }
        ]),
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        flagged: false
      },
      // URGENT - No water
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "There's no water coming out of any of the faucets. I can't shower or cook!",
        response: "I understand how frustrating that is! I've created an urgent maintenance request for the water supply issue. The property manager is checking with the building management and will get this resolved as quickly as possible.",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "urgent", description: "No water supply to apartment" }
        ]),
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        flagged: false
      },
      // NORMAL - Leaky faucet
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "The kitchen faucet has been dripping constantly for a few days. It's annoying and wasting water.",
        response: "Thanks for letting me know! I've created a maintenance request to fix the leaky faucet. A plumber will be scheduled to replace the washer or faucet as needed. In the meantime, you can try tightening the handle to see if that helps.",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "normal", description: "Leaky kitchen faucet" }
        ]),
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        flagged: false
      },
      // NORMAL - Broken light fixture
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "The light in the hallway keeps flickering and sometimes goes out completely. It's the one near the bathroom.",
        response: "I've logged a maintenance request for the flickering hallway light. An electrician will check the wiring and replace the fixture if needed. Please let me know if you notice any other electrical issues.",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "normal", description: "Flickering hallway light fixture" }
        ]),
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000), // 1.5 days ago
        flagged: false
      },
      // LOW - Minor paint touch-up
      {
        tenant_id: tenantIds[0],
        channel: "email",
        message: "There are some small scuff marks on the wall from when I moved in. Can someone come touch up the paint?",
        response: "Thanks for letting me know! I've created a low-priority maintenance request for the paint touch-ups. The property manager will schedule this during the next available maintenance window. Is there a specific color or area you'd like prioritized?",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "low", description: "Minor paint touch-ups needed on walls" }
        ]),
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        flagged: false
      },
      // LOW - Cabinet door loose
      {
        tenant_id: tenantIds[1],
        channel: "email",
        message: "One of the kitchen cabinet doors is a bit loose and doesn't close properly. It's not urgent but would be nice to get fixed.",
        response: "I've noted this and created a low-priority maintenance request for the loose cabinet door. The maintenance team will tighten the hinges during their next routine visit. Thanks for letting us know!",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "low", description: "Loose kitchen cabinet door" }
        ]),
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
        flagged: false
      },
      // General inquiry - WiFi password
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Hi, I forgot the WiFi password. Can you remind me?",
        response: "No problem! The WiFi network is 'PropertyWiFi-5G' and the password is 'Welcome123!'. Let me know if you need help connecting!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000), // 4 days ago
        flagged: false
      },
      // General inquiry - Rent due date
      {
        tenant_id: tenantIds[0],
        channel: "email",
        message: "When is rent due this month? I want to make sure I pay on time.",
        response: "Rent is due on the 1st of every month. Your monthly rent is $2,500. You can pay via check, bank transfer, or through the tenant portal. Let me know if you need any payment details!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 120 * 60 * 60 * 1000), // 5 days ago
        flagged: false
      }
    ];

    const conversationIds = [];
    for (const conv of conversations) {
      const convResult = await client.query(
        `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp, flagged)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [conv.tenant_id, conv.channel, conv.message, conv.response, conv.ai_actions, conv.timestamp, conv.flagged]
      );
      const conversation = convResult.rows[0];
      conversationIds.push(conversation.id);
      console.log(`✓ Created conversation: ${conv.message.substring(0, 50)}...`);
    }

    // Create maintenance requests from conversations with actions
    const maintenanceRequests = [
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        conversation_id: conversationIds[0],
        issue_description: "Burst pipe causing flooding in bathroom",
        priority: "emergency",
        status: "open",
        notes: "Emergency - Immediate action required. Tenant notified to turn off main water valve."
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        conversation_id: conversationIds[1],
        issue_description: "Strong gas smell in kitchen",
        priority: "emergency",
        status: "open",
        notes: "Emergency - Tenant evacuated. 911 called."
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        conversation_id: conversationIds[2],
        issue_description: "Heating system not working",
        priority: "urgent",
        status: "open",
        notes: "Urgent - HVAC technician needed ASAP"
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        conversation_id: conversationIds[3],
        issue_description: "No water supply to apartment",
        priority: "urgent",
        status: "in_progress",
        notes: "Building management contacted"
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        conversation_id: conversationIds[4],
        issue_description: "Leaky kitchen faucet",
        priority: "normal",
        status: "open",
        notes: "Plumber to be scheduled"
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        conversation_id: conversationIds[5],
        issue_description: "Flickering hallway light fixture",
        priority: "normal",
        status: "open",
        notes: "Electrician to inspect wiring"
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        conversation_id: conversationIds[6],
        issue_description: "Minor paint touch-ups needed on walls",
        priority: "low",
        status: "open",
        notes: "Schedule during next maintenance window"
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        conversation_id: conversationIds[7],
        issue_description: "Loose kitchen cabinet door",
        priority: "low",
        status: "open",
        notes: "Tighten hinges during routine visit"
      }
    ];

    for (const mr of maintenanceRequests) {
      await client.query(
        `INSERT INTO maintenance_requests (property_id, tenant_id, conversation_id, issue_description, priority, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [mr.property_id, mr.tenant_id, mr.conversation_id, mr.issue_description, mr.priority, mr.status, mr.notes, new Date()]
      );
      console.log(`✓ Created maintenance request: ${mr.priority} - ${mr.issue_description.substring(0, 40)}...`);
    }

    console.log("\n✓ Mock data seeding complete!");
    console.log("\nSummary:");
    console.log(`  Properties: 1`);
    console.log(`  Tenants: ${tenants.length}`);
    console.log(`  Conversations: ${conversations.length}`);
    console.log(`  Maintenance Requests: ${maintenanceRequests.length}`);
    console.log(`  Emergency Requests: 2`);
    console.log(`  Urgent Requests: 2`);
    console.log(`  Normal Requests: 2`);
    console.log(`  Low Requests: 2`);

  } catch (error) {
    console.error("Mock data seeding error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMockData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Mock data seeding failed!");
    process.exit(1);
  });
