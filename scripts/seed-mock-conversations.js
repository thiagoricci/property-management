const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper function to add hours to a date
function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

// Helper function to add minutes to a date
function addMinutes(date, minutes) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

async function seedMockData() {
  const client = await pool.connect();

  try {
    console.log("Starting mock data generation...\n");

    await client.query("BEGIN");

    // ========================================
    // 1. CREATE PROPERTIES
    // ========================================
    console.log("Creating properties...");

    const properties = [];

    // Property 1: Downtown apartment
    const property1Result = await client.query(
      `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules, faq)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
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
        JSON.stringify({
          wifi: "Network: PropertyWiFi-5G, Password: Welcome123!",
          parking: "Street parking available on first-come basis",
          pool_hours: "8AM-10PM, rooftop access",
          laundry: "Laundry room on ground floor, coin-operated",
        }),
      ]
    );
    properties.push(property1Result.rows[0]);
    console.log(`✓ Created property 1: ${properties[0].address}`);

    // Property 2: Suburban house
    const property2Result = await client.query(
      `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules, faq)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        "456 Oak Lane, Pleasanton, CA 94588",
        "Sarah Johnson",
        "sarah.johnson@example.com",
        "+1-555-0102",
        JSON.stringify({
          wifi: "OakLane-Guest",
          wifi_password: "HomeSweetHome2024",
          parking: "2-car garage + driveway",
          laundry: "In-unit washer/dryer",
          yard: "Backyard with BBQ grill",
          security: "Smart lock with keyless entry",
        }),
        JSON.stringify({
          quiet_hours: "9PM - 7AM",
          guest_policy: "Guests allowed with prior notice",
          pet_policy: "Dogs and cats allowed with pet deposit",
          smoking_policy: "No smoking inside, outdoor only",
          rent_due: "1st of every month",
          maintenance_requests: "Text or email for urgent issues",
        }),
        JSON.stringify({
          wifi: "Network: OakLane-Guest, Password: HomeSweetHome2024",
          parking: "2-car garage + driveway parking available",
          pets: "Dogs and cats allowed with $300 pet deposit",
          trash: "Trash pickup on Tuesday and Friday",
        }),
      ]
    );
    properties.push(property2Result.rows[0]);
    console.log(`✓ Created property 2: ${properties[1].address}`);

    // Property 3: Urban studio
    const property3Result = await client.query(
      `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules, faq)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        "789 Market Street, Studio 12, San Francisco, CA 94103",
        "Michael Chen",
        "michael.chen@example.com",
        "+1-555-0103",
        JSON.stringify({
          wifi: "MarketSt-Resident",
          wifi_password: "UrbanLiving2024",
          parking: "Monthly parking available for $200",
          laundry: "Shared laundry in basement",
          gym: "Building gym on 2nd floor",
          security: "24/7 doorman and keycard access",
        }),
        JSON.stringify({
          quiet_hours: "10PM - 7AM",
          guest_policy: "Guests allowed for up to 2 nights",
          pet_policy: "Cats only, no dogs",
          smoking_policy: "No smoking anywhere",
          rent_due: "1st of every month",
          maintenance_requests: "Submit through building portal or text",
        }),
        JSON.stringify({
          wifi: "Network: MarketSt-Resident, Password: UrbanLiving2024",
          parking: "Monthly parking available for $200/month",
          gym: "Building gym on 2nd floor, 24/7 access",
          doorman: "24/7 doorman and package handling",
        }),
      ]
    );
    properties.push(property3Result.rows[0]);
    console.log(`✓ Created property 3: ${properties[2].address}`);

    // ========================================
    // 2. CREATE TENANTS
    // ========================================
    console.log("\nCreating tenants...");

    const tenants = [];

    // Tenant 1: Alice Johnson
    const tenant1Result = await client.query(
      `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone) DO NOTHING
       RETURNING *`,
      [
        properties[0].id,
        "Alice Johnson",
        "+1-555-0201",
        "alice.johnson@example.com",
        JSON.stringify({
          monthly_rent: 2800,
          lease_start: "2024-01-01",
          lease_end: "2024-12-31",
          security_deposit: 2800,
        }),
        "2024-01-01",
      ]
    );
    tenants.push(tenant1Result.rows[0]);
    console.log(`✓ Created tenant 1: ${tenants[0].name} (ID: ${tenants[0].id})`);

    // Tenant 2: Bob Martinez
    const tenant2Result = await client.query(
      `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone) DO NOTHING
       RETURNING *`,
      [
        properties[1].id,
        "Bob Martinez",
        "+1-555-0202",
        "bob.martinez@example.com",
        JSON.stringify({
          monthly_rent: 3500,
          lease_start: "2024-02-01",
          lease_end: "2025-01-31",
          security_deposit: 3500,
        }),
        "2024-02-01",
      ]
    );
    tenants.push(tenant2Result.rows[0]);
    console.log(`✓ Created tenant 2: ${tenants[1].name} (ID: ${tenants[1].id})`);

    // Tenant 3: Carol Chen
    const tenant3Result = await client.query(
      `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone) DO NOTHING
       RETURNING *`,
      [
        properties[2].id,
        "Carol Chen",
        "+1-555-0203",
        "carol.chen@example.com",
        JSON.stringify({
          monthly_rent: 2200,
          lease_start: "2024-03-01",
          lease_end: "2024-12-31",
          security_deposit: 2200,
        }),
        "2024-03-01",
      ]
    );
    tenants.push(tenant3Result.rows[0]);
    console.log(`✓ Created tenant 3: ${tenants[2].name} (ID: ${tenants[2].id})`);

    // ========================================
    // 3. CREATE CONVERSATION THREADS
    // ========================================
    console.log("\nCreating conversation threads...");

    const threads = [];

    // Thread 1: Leaking faucet (Alice Johnson)
    const thread1StartTime = addHours(new Date(), -72); // 3 days ago
    const thread1Result = await client.query(
      `INSERT INTO conversation_threads (tenant_id, property_id, subject, status, channel, created_at, last_activity_at, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenants[0].id,
        properties[0].id,
        "Leaking bathroom faucet - maintenance request",
        "resolved",
        "sms",
        thread1StartTime,
        thread1StartTime,
        "Tenant reported leaking bathroom faucet. Maintenance request created and resolved successfully.",
      ]
    );
    threads.push(thread1Result.rows[0]);
    console.log(`✓ Created thread 1: "${threads[0].subject}"`);

    // Thread 2: Pool access inquiry (Bob Martinez)
    const thread2StartTime = addHours(new Date(), -48); // 2 days ago
    const thread2Result = await client.query(
      `INSERT INTO conversation_threads (tenant_id, property_id, subject, status, channel, created_at, last_activity_at, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenants[1].id,
        properties[1].id,
        "Pool hours and guest policy inquiry",
        "resolved",
        "sms",
        thread2StartTime,
        thread2StartTime,
        "Tenant inquired about pool hours and guest policy. All questions answered satisfactorily.",
      ]
    );
    threads.push(thread2Result.rows[0]);
    console.log(`✓ Created thread 2: "${threads[1].subject}"`);

    // Thread 3: Power outage (Carol Chen)
    const thread3StartTime = addHours(new Date(), -24); // 1 day ago
    const thread3Result = await client.query(
      `INSERT INTO conversation_threads (tenant_id, property_id, subject, status, channel, created_at, last_activity_at, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenants[2].id,
        properties[2].id,
        "Power outage emergency - resolved",
        "resolved",
        "sms",
        thread3StartTime,
        thread3StartTime,
        "Emergency power outage reported. Issue was isolated to tenant's unit. Circuit breaker was tripped and reset. Power restored.",
      ]
    );
    threads.push(thread3Result.rows[0]);
    console.log(`✓ Created thread 3: "${threads[2].subject}"`);

    // ========================================
    // 4. CREATE MESSAGES
    // ========================================
    console.log("\nCreating messages...");

    // Thread 1: Leaking faucet (10 messages)
    const thread1Messages = [
      {
        message: "Hi, the faucet in my bathroom is leaking badly. Water is dripping constantly.",
        response: "I'm sorry to hear about the leaking faucet, Alice! That sounds frustrating. Can you tell me which faucet it is and when it started?",
        ai_actions: null,
      },
      {
        message: "It's the cold water tap in the master bathroom sink. Started about 2 hours ago.",
        response: "Thank you for the details. A master bathroom cold water tap leak needs attention. I'll create a maintenance request for you right away.",
        ai_actions: JSON.stringify([
          {
            action: "maintenance_request",
            priority: "urgent",
            description: "Cold water tap leaking in master bathroom sink. Started 2 hours ago. Constant dripping.",
          },
        ]),
      },
      {
        message: "Should I turn off the water supply to the sink?",
        response: "Yes, that's a good idea for now! You can usually find the shut-off valve under the sink. Turn it clockwise to stop the water flow. This will prevent further water waste while we get it fixed.",
        ai_actions: null,
      },
      {
        message: "I did that. How soon can someone come to fix it?",
        response: "I've prioritized this as urgent since it's actively leaking. A plumber should be able to visit within 24-48 hours. You'll receive a notification when the appointment is scheduled. Is there anything else you need in the meantime?",
        ai_actions: null,
      },
      {
        message: "Thanks, that helps. Will I get updates on the progress?",
        response: "Absolutely! You'll receive updates via SMS when: 1) The appointment is scheduled, 2) The plumber is on their way, and 3) The repair is complete. You can also check the status anytime by texting me. Is there anything else I can help you with?",
        ai_actions: null,
      },
      {
        message: "No, that's all for now. Thanks for your help!",
        response: "You're welcome, Alice! I'm glad I could help. Don't hesitate to reach out if you have any other questions or issues. Have a great day!",
        ai_actions: null,
      },
      {
        message: "Actually, one more thing - is there a way to track this online?",
        response: "Yes! You can log into your tenant portal at our website to view all maintenance requests, check their status, and see the complete history. You can also access it from your phone. Would you like me to send you the link?",
        ai_actions: null,
      },
      {
        message: "Yes, please send the link.",
        response: "Here's the link: https://property-manager.example.com/portal. You can log in with your email and the password you set up. Let me know if you have any trouble accessing it!",
        ai_actions: null,
      },
      {
        message: "Got it, thanks!",
        response: "Perfect! Is there anything else you need help with today?",
        ai_actions: null,
      },
      {
        message: "No, that's everything. Have a good one!",
        response: "You too, Alice! Take care, and I hope your faucet gets fixed soon!",
        ai_actions: null,
      },
    ];

    let currentTime = thread1StartTime;
    for (let i = 0; i < thread1Messages.length; i++) {
      const msg = thread1Messages[i];
      currentTime = addMinutes(currentTime, 20 + Math.floor(Math.random() * 15)); // 20-35 minutes apart

      await client.query(
        `INSERT INTO messages (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          threads[0].id,
          tenants[0].id,
          "sms",
          msg.message,
          msg.response,
          msg.ai_actions,
          "user_message",
          currentTime,
        ]
      );
    }
    console.log(`✓ Created 10 messages for thread 1`);

    // Thread 2: Pool access inquiry (10 messages)
    const thread2Messages = [
      {
        message: "Hi! What are the pool hours? I want to go swimming tonight.",
        response: "Hi Bob! The pool is open from 8AM to 10PM every day. It's on the rooftop and has a great view of the city. Enjoy your swim tonight!",
        ai_actions: null,
      },
      {
        message: "Can I bring guests to the pool?",
        response: "Yes, you can bring guests! According to your lease, guests are allowed for up to 3 nights. Just make sure they follow all pool rules and are respectful of other residents.",
        ai_actions: null,
      },
      {
        message: "Is there a limit on how many guests I can bring?",
        response: "There's no specific limit on the number of guests at the pool, but we ask that you be mindful of capacity and ensure all guests are registered if they're staying overnight. For day visits, just keep it reasonable and consider other residents who want to use the pool too.",
        ai_actions: null,
      },
      {
        message: "Do I need to sign them in somewhere?",
        response: "For day use at the pool, no sign-in is required. However, if guests are staying overnight (up to 3 nights per your lease), you should inform the building management. You can do this through the tenant portal or by texting me with their names and dates.",
        ai_actions: null,
      },
      {
        message: "Perfect, thanks for the info! Are there any pool rules I should know about?",
        response: "Yes, a few important rules: 1) No glass containers, 2) Proper swimwear required, 3) No diving in shallow areas, 4) Keep noise to a reasonable level, especially after 9PM, 5) Children under 14 must be supervised. The full list is posted at the pool entrance.",
        ai_actions: null,
      },
      {
        message: "Is the pool heated?",
        response: "Yes, the pool is heated year-round to a comfortable 82-84°F. It's great for swimming even in cooler weather. The hot tub is also available and maintained at 102-104°F.",
        ai_actions: null,
      },
      {
        message: "Awesome! Can I bring food and drinks?",
        response: "Yes, you can bring food and non-alcoholic drinks. Just remember - no glass containers for safety reasons. Plastic containers and cans are perfectly fine. There are tables and chairs on the rooftop where you can enjoy your snacks.",
        ai_actions: null,
      },
      {
        message: "What about music?",
        response: "You can play music, but please keep the volume reasonable and use headphones or portable speakers at a low level. Other residents may want to relax quietly, especially in the evenings. The general quiet hours are 10PM-8AM.",
        ai_actions: null,
      },
      {
        message: "Perfect, thanks for all the info!",
        response: "You're welcome, Bob! I hope you have a great time at the pool tonight. Is there anything else you'd like to know?",
        ai_actions: null,
      },
      {
        message: "No, that's everything. Thanks!",
        response: "Great! Enjoy your swim, and feel free to reach out anytime if you have questions. Have a wonderful evening!",
        ai_actions: null,
      },
    ];

    currentTime = thread2StartTime;
    for (let i = 0; i < thread2Messages.length; i++) {
      const msg = thread2Messages[i];
      currentTime = addMinutes(currentTime, 15 + Math.floor(Math.random() * 10)); // 15-25 minutes apart

      await client.query(
        `INSERT INTO messages (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          threads[1].id,
          tenants[1].id,
          "sms",
          msg.message,
          msg.response,
          msg.ai_actions,
          "user_message",
          currentTime,
        ]
      );
    }
    console.log(`✓ Created 10 messages for thread 2`);

    // Thread 3: Power outage emergency (10 messages)
    const thread3Messages = [
      {
        message: "Emergency! The power just went out in my unit. I can't see anything!",
        response: "I understand this is an emergency, Carol! Please stay calm and safe. First, are you in any immediate danger? Do you have a phone light or flashlight available?",
        ai_actions: JSON.stringify([
          {
            action: "alert_manager",
            urgency: "immediate",
            reason: "Power outage emergency reported by tenant",
          },
        ]),
      },
      {
        message: "I'm using my phone flashlight. Should I call the building manager?",
        response: "I've already alerted the building management about your emergency situation. Before you call, let's check a few things. Is this affecting your entire unit or just certain areas? Also, can you see if your neighbors have power?",
        ai_actions: null,
      },
      {
        message: "Everything is out - lights, outlets, everything. I can't tell about neighbors.",
        response: "Thank you for that information. Please check if your circuit breaker has tripped. It's usually in a panel near your front door or in a closet. Look for any switches that are in the middle position or turned off. Can you check that for me?",
        ai_actions: null,
      },
      {
        message: "I found the panel. One switch is in the middle position.",
        response: "That's likely the tripped breaker! Try flipping it all the way to OFF first, wait a second, then flip it firmly back to ON. This should reset it. Let me know what happens!",
        ai_actions: null,
      },
      {
        message: "I did that. The power came back on!",
        response: "Excellent news, Carol! I'm so glad the power is back on. The tripped breaker suggests there may have been a power surge or overload. Please monitor your electrical usage and avoid running too many high-power appliances at once. Is everything working normally now?",
        ai_actions: null,
      },
      {
        message: "Yes, everything seems fine now. Should I be worried about it happening again?",
        response: "It's possible it could happen again if there's an underlying issue. I recommend: 1) Avoid overloading circuits, 2) Unplug sensitive electronics during storms, 3) If it happens frequently, let us know so we can have an electrician inspect. Would you like me to create a maintenance request for an electrical inspection?",
        ai_actions: null,
      },
      {
        message: "Yes, please. I'd rather be safe than sorry.",
        response: "I've created a maintenance request for an electrical inspection. An electrician will check your unit's electrical system within the next few days to ensure everything is safe. You'll receive a notification when the appointment is scheduled. Is there anything else you need right now?",
        ai_actions: JSON.stringify([
          {
            action: "maintenance_request",
            priority: "normal",
            description: "Electrical inspection requested after circuit breaker tripped and caused power outage. Tenant wants to ensure electrical system is safe.",
          },
        ]),
      },
      {
        message: "No, I think I'm good. Thanks for the quick help!",
        response: "You're very welcome, Carol! I'm glad we could resolve this quickly. Your safety is our top priority. The electrician will follow up with you soon. In the meantime, if you experience any electrical issues or the power goes out again, please text me immediately.",
        ai_actions: null,
      },
      {
        message: "Will do. Have a good night!",
        response: "You too, Carol! Rest easy knowing we're monitoring your unit and will have an electrician check everything. Goodnight!",
        ai_actions: null,
      },
      {
        message: "Thanks again!",
        response: "Anytime! Take care, and don't hesitate to reach out if you need anything. Goodnight!",
        ai_actions: null,
      },
    ];

    currentTime = thread3StartTime;
    for (let i = 0; i < thread3Messages.length; i++) {
      const msg = thread3Messages[i];
      currentTime = addMinutes(currentTime, 10 + Math.floor(Math.random() * 10)); // 10-20 minutes apart (emergency = faster responses)

      await client.query(
        `INSERT INTO messages (thread_id, tenant_id, channel, message, response, ai_actions, message_type, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          threads[2].id,
          tenants[2].id,
          "sms",
          msg.message,
          msg.response,
          msg.ai_actions,
          "user_message",
          currentTime,
        ]
      );
    }
    console.log(`✓ Created 10 messages for thread 3`);

    // Update last_activity_at for threads
    for (const thread of threads) {
      const lastMessageResult = await client.query(
        `SELECT timestamp FROM messages WHERE thread_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [thread.id]
      );
      if (lastMessageResult.rows.length > 0) {
        await client.query(
          `UPDATE conversation_threads SET last_activity_at = $1 WHERE id = $2`,
          [lastMessageResult.rows[0].timestamp, thread.id]
        );
      }
    }

    await client.query("COMMIT");

    // ========================================
    // VERIFICATION
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("MOCK DATA GENERATION COMPLETE!");
    console.log("=".repeat(50) + "\n");

    const propertyCount = await client.query("SELECT COUNT(*) FROM properties");
    const tenantCount = await client.query("SELECT COUNT(*) FROM tenants");
    const threadCount = await client.query("SELECT COUNT(*) FROM conversation_threads");
    const messageCount = await client.query("SELECT COUNT(*) FROM messages");

    console.log("Summary:");
    console.log(`  Properties: ${propertyCount.rows[0].count}`);
    console.log(`  Tenants: ${tenantCount.rows[0].count}`);
    console.log(`  Conversation Threads: ${threadCount.rows[0].count}`);
    console.log(`  Messages: ${messageCount.rows[0].count}`);

    const messagesPerThread = await client.query(
      `SELECT thread_id, COUNT(*) as msg_count FROM messages GROUP BY thread_id ORDER BY thread_id`
    );
    console.log("\nMessages per thread:");
    messagesPerThread.rows.forEach((row) => {
      console.log(`  Thread ${row.thread_id}: ${row.msg_count} messages`);
    });

    console.log("\nTenant Details:");
    for (const tenant of tenants) {
      const thread = threads.find((t) => t.tenant_id === tenant.id);
      console.log(`  ${tenant.name} (ID: ${tenant.id})`);
      console.log(`    Property: ${properties.find((p) => p.id === tenant.property_id).address}`);
      console.log(`    Phone: ${tenant.phone}`);
      console.log(`    Thread: "${thread.subject}"`);
      console.log(`    Messages: ${messagesPerThread.rows.find((m) => m.thread_id === thread.id).msg_count}`);
    }

    console.log("\n✓ All mock data created successfully!");
    console.log("\nYou can now view the conversations in the dashboard.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n✗ Error during mock data generation:");
    console.error(error);
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
    console.error("\n✗ Mock data generation failed!");
    process.exit(1);
  });
