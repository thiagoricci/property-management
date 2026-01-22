const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedConversationThreads() {
  const client = await pool.connect();

  try {
    console.log("Starting conversation threads seeding...\n");

    // Get existing property or create one
    let propertyResult = await client.query(
      `SELECT * FROM properties LIMIT 1`
    );

    let property;
    if (propertyResult.rows.length === 0) {
      propertyResult = await client.query(
        `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules, faq)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
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
          JSON.stringify([
            {
              question: "What is the WiFi password?",
              answer: "The WiFi network is 'PropertyWiFi-5G' and the password is 'Welcome123!'"
            },
            {
              question: "When is rent due?",
              answer: "Rent is due on the 1st of every month."
            },
            {
              question: "Is parking available?",
              answer: "Yes, street parking is available for all tenants."
            }
          ])
        ]
      );
      property = propertyResult.rows[0];
      console.log(`✓ Created property: ${property.address}`);
    } else {
      property = propertyResult.rows[0];
      console.log(`✓ Using existing property: ${property.address}`);
    }

    // Create 3 tenants
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

    // TENANT 1: EMERGENCY - Burst Pipe (10 messages)
    console.log("\n--- Creating Emergency Conversation (Tenant: Alice Johnson) ---");
    const emergencyConversation = [
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "HELP! There's water everywhere! A pipe burst in bathroom!",
        response: "This is an EMERGENCY! I've immediately notified the property manager and created an emergency maintenance request. Please turn off the main water valve if you can find it (usually under the sink or near the water meter). Move any valuables away from the water. Help is on the way!",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "emergency", description: "Burst pipe causing flooding in bathroom" },
          { action: "alert_manager", urgency: "immediate", reason: "Emergency: Burst pipe causing flooding" }
        ]),
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        flagged: true
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "I found the valve but it's stuck! What do I do?",
        response: "Try using pliers or a wrench to gently turn it. If it's completely stuck, don't force it - you could break it. Instead, focus on containing the water with towels and buckets. I've already alerted an emergency plumber who should be there within 30 minutes.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 1.9 * 60 * 60 * 1000),
        flagged: true
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "Okay, I turned it off but there's still water everywhere!",
        response: "Good job turning off the water! Now use towels to soak up as much water as possible. If you have a wet/dry vacuum, that would help too. The emergency plumber is en route and should arrive very soon. The property manager has also been notified and is coming to help.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000),
        flagged: true
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "The manager is here now, thank you!",
        response: "That's great news! The manager will coordinate with the plumber to get this fixed quickly. Please let me know if you need anything else or if there's any additional damage. I'll keep track of this situation and make sure everything is resolved properly.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "Will my belongings be covered?",
        response: "That depends on your renter's insurance policy. I'd recommend checking your policy for water damage coverage. The property's insurance typically covers building damage, but personal belongings are usually covered by tenant insurance. Let me know if you need help filing a claim.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "I don't have renter's insurance. What should I do?",
        response: "I understand this is stressful. The property manager will document all the damage for you. For future reference, I highly recommend getting renter's insurance - it's usually quite affordable and covers situations like this. In the meantime, let's focus on getting the pipe fixed and minimizing any further damage.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 0.9 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "The plumber fixed the pipe! Water is back on.",
        response: "Excellent news! I'm glad the issue is resolved. The maintenance request will be marked as complete. Is there any water damage to the bathroom that needs attention? The property manager can arrange for repairs if needed.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 0.8 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "There's some water damage to the floor, but not too bad.",
        response: "I've noted that there's water damage to the floor. The property manager will schedule repairs. Please take photos of the damage for your records. Is there anything else you need help with right now?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 0.7 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "No, that's all for now. Thanks for the quick help!",
        response: "You're very welcome! I'm glad we could help resolve this emergency quickly. Don't hesitate to reach out if you need anything else. Stay safe!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 0.6 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[0],
        channel: "sms",
        message: "One more thing - should I keep the area ventilated?",
        response: "Yes, absolutely! Good thinking. Keep the bathroom well-ventilated to help dry out any remaining moisture and prevent mold growth. You might want to run the exhaust fan or open a window if possible. The property manager will check on the repairs soon.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 0.5 * 60 * 60 * 1000),
        flagged: false
      }
    ];

    // TENANT 2: URGENT - No Heat (10 messages)
    console.log("\n--- Creating Urgent Conversation (Tenant: Bob Martinez) ---");
    const urgentConversation = [
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "The heating isn't working and it's freezing in here! It's been off since last night.",
        response: "I'm so sorry about that, especially in this cold weather! I've created an URGENT maintenance request for the heating system. The property manager is contacting an HVAC technician right now to get this fixed as quickly as possible. How cold is it inside right now?",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "urgent", description: "Heating system not working - apartment is freezing" }
        ]),
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "It's about 55 degrees inside. I'm really cold.",
        response: "That's definitely too cold! I've marked this as high priority. The HVAC technician should be able to come today. In the meantime, do you have any space heaters you can use? Also, try to close all doors and windows to retain whatever heat is available.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 4.8 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "I have a small space heater. Can I use it?",
        response: "Yes, absolutely! A space heater will help. Just be careful to keep it away from flammable materials like curtains, bedding, or furniture. Never leave it unattended or running while you sleep. Place it on a flat, stable surface away from foot traffic.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 4.6 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "Okay, I have it running. What else should I do?",
        response: "Good! Here are some additional tips: wear extra layers of clothing, use warm blankets, drink warm beverages, and keep moving around to generate body heat. Close doors to unused rooms to concentrate heat in the area you're using. The technician should be there soon.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 4.4 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "How long until the technician can come?",
        response: "The property manager is working on scheduling now. They're hoping to get someone there within 2-3 hours. I'll keep you updated. If the temperature drops below 50 degrees or you start feeling unwell, please let me know immediately and we can arrange temporary accommodation.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 4.2 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "It's getting colder. Now about 52 degrees.",
        response: "I've noted the temperature drop. Let me check with the property manager on the technician's ETA. In the meantime, please bundle up and stay in one room with the space heater. Are you feeling okay physically? Any signs of hypothermia like shivering, confusion, or drowsiness?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "I'm okay, just cold. The technician just arrived!",
        response: "That's wonderful news! The technician should be able to diagnose and fix the issue quickly. Please let me know once the heat is back on and working properly. I'll keep the maintenance request updated with the status.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "They're working on it now. Said it's a thermostat issue.",
        response: "Good to know! Thermostat issues are usually fixable quickly. They may need to replace or recalibrate it. The heat should be back on soon. Is there anything else you need while you wait?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "Heat is back on! Thank you so much for the help.",
        response: "Excellent! I'm so glad the heat is working again. The maintenance request will be marked as resolved. Please let the apartment warm up gradually - avoid setting the thermostat too high initially. Is the temperature rising now?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[1],
        channel: "sms",
        message: "Yes, it's getting warmer. Thanks again!",
        response: "You're very welcome! I'm sorry for the inconvenience and the cold. The property manager will follow up to make sure everything continues working properly. Don't hesitate to reach out if you have any other issues. Stay warm!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        flagged: false
      }
    ];

    // TENANT 3: NORMAL - Leaky Faucet (10 messages)
    console.log("\n--- Creating Normal Conversation (Tenant: Carol Williams) ---");
    const normalConversation = [
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "The kitchen faucet has been dripping constantly for a few days. It's annoying and wasting water.",
        response: "Thanks for letting me know! I've created a maintenance request to fix the leaky faucet. A plumber will be scheduled to replace the washer or faucet as needed. In the meantime, you can try gently tightening the handle to see if that helps stop the drip.",
        ai_actions: JSON.stringify([
          { action: "maintenance_request", priority: "normal", description: "Leaky kitchen faucet - dripping constantly for several days" }
        ]),
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "I tried tightening it but it's still dripping.",
        response: "Thanks for trying! It sounds like the internal washer or O-ring needs to be replaced, which is a common and quick fix. The plumber will take care of it. When would be a good time for someone to come by? We can schedule around your availability.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "I'm available Tuesday afternoon if that works.",
        response: "Tuesday afternoon works perfectly! I've scheduled the plumber for Tuesday between 2-4 PM. You don't need to be home the entire time, just be available when they arrive. They'll call about 30 minutes before coming.",
        ai_actions: null,
        timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Great, thanks. Should I do anything before they arrive?",
        response: "Good question! Please clear the area under the sink so the plumber has easy access. Remove any cleaning supplies or items stored there. Also, make sure the water supply valves under the sink are accessible. That's about it - they'll handle everything else!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Will do. Is this going to cost me anything?",
        response: "No, this is covered under normal maintenance. There's no charge to you for fixing a leaky faucet. It's part of the property upkeep. If you ever have questions about what's covered vs. what you'd pay for, just ask!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "The plumber came and fixed it! Thanks!",
        response: "Excellent! I'm glad the issue is resolved. The maintenance request will be marked as complete. Is the faucet working properly now? No more dripping?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Yes, it's working perfectly now. No more drips!",
        response: "That's great to hear! Thank you for reporting the issue promptly. Leaky faucets can waste a lot of water over time, so it's good we got it fixed. Is there anything else you need help with today?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "No, that's all. Thanks for the quick scheduling!",
        response: "You're very welcome! I'm glad we could get it taken care of quickly. Don't hesitate to reach out if you notice any other issues or have questions about the property. Have a great day!",
        ai_actions: null,
        timestamp: new Date(Date.now() - 17 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Actually, one more question - what about the bathroom sink? It drips a little too.",
        response: "Thanks for mentioning that! Would you like me to add that to the maintenance request as well? The plumber can fix both sinks while they're here, or we can schedule a separate visit. Which would you prefer?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 16 * 60 * 60 * 1000),
        flagged: false
      },
      {
        tenant_id: tenantIds[2],
        channel: "sms",
        message: "Let's do it separately, it's not too bad.",
        response: "Sounds good! I've noted the bathroom sink drip for a future maintenance request. Since it's minor, we can address it during the next routine maintenance visit. If it gets worse, just let me know and we can schedule it sooner. Anything else?",
        ai_actions: null,
        timestamp: new Date(Date.now() - 15 * 60 * 60 * 1000),
        flagged: false
      }
    ];

    // Insert all conversations
    const allConversations = [...emergencyConversation, ...urgentConversation, ...normalConversation];
    const conversationIds = [];

    for (const conv of allConversations) {
      const convResult = await client.query(
        `INSERT INTO conversations (tenant_id, channel, message, response, ai_actions, timestamp, flagged)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [conv.tenant_id, conv.channel, conv.message, conv.response, conv.ai_actions, conv.timestamp, conv.flagged]
      );
      const conversation = convResult.rows[0];
      conversationIds.push(conversation.id);
      console.log(`✓ Created message ${conversationIds.length}/30: ${conv.message.substring(0, 40)}...`);
    }

    // Create maintenance requests (one per tenant's main issue)
    const maintenanceRequests = [
      {
        property_id: property.id,
        tenant_id: tenantIds[0],
        conversation_id: conversationIds[0], // First message of emergency conversation
        issue_description: "Burst pipe causing flooding in bathroom",
        priority: "emergency",
        status: "resolved",
        notes: "Emergency - Immediate action required. Plumber fixed the pipe. Floor has water damage that needs repair."
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[1],
        conversation_id: conversationIds[10], // First message of urgent conversation
        issue_description: "Heating system not working - apartment is freezing",
        priority: "urgent",
        status: "resolved",
        notes: "Urgent - Thermostat issue. HVAC technician repaired thermostat. Heat restored."
      },
      {
        property_id: property.id,
        tenant_id: tenantIds[2],
        conversation_id: conversationIds[20], // First message of normal conversation
        issue_description: "Leaky kitchen faucet - dripping constantly for several days",
        priority: "normal",
        status: "resolved",
        notes: "Normal - Plumber replaced washer/O-ring. Faucet working properly. Bathroom sink drip noted for future maintenance."
      }
    ];

    for (const mr of maintenanceRequests) {
      await client.query(
        `INSERT INTO maintenance_requests (property_id, tenant_id, conversation_id, issue_description, priority, status, notes, created_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [mr.property_id, mr.tenant_id, mr.conversation_id, mr.issue_description, mr.priority, mr.status, mr.notes, new Date(), new Date()]
      );
      console.log(`✓ Created maintenance request: ${mr.priority.toUpperCase()} - ${mr.issue_description.substring(0, 40)}...`);
    }

    console.log("\n✓ Conversation threads seeding complete!");
    console.log("\nSummary:");
    console.log(`  Properties: 1`);
    console.log(`  Tenants: ${tenants.length}`);
    console.log(`  Total Messages: ${allConversations.length}`);
    console.log(`  Messages per Tenant: 10 each`);
    console.log(`  Maintenance Requests: ${maintenanceRequests.length}`);
    console.log(`\nConversation Details:`);
    console.log(`  1. Alice Johnson - Emergency (Burst Pipe) - 10 messages`);
    console.log(`  2. Bob Martinez - Urgent (No Heat) - 10 messages`);
    console.log(`  3. Carol Williams - Normal (Leaky Faucet) - 10 messages`);

  } catch (error) {
    console.error("Conversation threads seeding error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedConversationThreads()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Conversation threads seeding failed!");
    process.exit(1);
  });
