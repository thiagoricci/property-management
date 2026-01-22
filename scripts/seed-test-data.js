/**
 * Seed Test Data Script
 * Creates 3 tenants, each with 1 conversation thread containing 10 messages
 * and 2 maintenance requests (1 emergency, 1 normal)
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/property_manager',
});

// Mock data for 3 tenants
const tenantsData = [
  {
    name: 'John Smith',
    phone: '+15551234567',
    email: 'john.smith@example.com',
    property: {
      address: '123 Main Street',
      owner_name: 'Alice Johnson',
      owner_email: 'alice.johnson@property.com',
      owner_phone: '+15559876543',
      amenities: {
        parking: true,
        gym: true,
        pool: false,
        laundry: 'in-unit'
      },
      rules: {
        quiet_hours: '10pm - 7am',
        pet_policy: 'no pets allowed',
        smoking_policy: 'no smoking'
      }
    },
    lease_terms: {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      rent: 1500,
      due_date: 1
    },
    move_in_date: '2024-01-01',
    thread: {
      subject: 'General inquiries and maintenance issues',
      channel: 'sms',
      messages: [
        {
          user: 'Hi, I have a question about the WiFi password',
          ai: 'Hello John! The WiFi password is "MainStreet123". Let me know if you need anything else!'
        },
        {
          user: 'Thanks! Also, when is trash pickup day?',
          ai: 'You\'re welcome! Trash pickup is every Tuesday morning. Please put bins out the night before.'
        },
        {
          user: 'There\'s a burst pipe in my bathroom! Water is everywhere!',
          ai: 'This is an emergency! I\'ve immediately notified the property manager and created an urgent maintenance request. Please turn off the water supply if you can locate the shut-off valve. Stay safe!',
          emergency: true,
          emergency_description: 'Burst pipe flooding bathroom - immediate attention required'
        },
        {
          user: 'I found the shut-off valve and turned it off. Thanks for the quick response!',
          ai: 'Great job, John! A plumber has been dispatched and should arrive within the hour. I\'ll keep you updated on the progress.'
        },
        {
          user: 'The plumber fixed it. Just wanted to let you know.',
          ai: 'Thank you for the update! I\'m glad the issue is resolved. Is there anything else I can help you with today?'
        },
        {
          user: 'Also, the kitchen faucet has been dripping slowly for a few days',
          ai: 'I\'ve logged a normal priority maintenance request for the kitchen faucet. A maintenance technician will address this within the next few days. Is the drip constant or intermittent?',
          normal: true,
          normal_description: 'Kitchen faucet dripping'
        },
        {
          user: 'It\'s pretty constant, about 1 drop per second',
          ai: 'Noted. I\'ve updated the maintenance request with those details. This will help the technician bring the right parts. Thank you for reporting it!'
        },
        {
          user: 'Can I get a copy of the lease agreement?',
          ai: 'I\'ll forward your request to the property manager. They can provide a digital copy of your lease agreement. You should receive it via email within 24 hours.'
        },
        {
          user: 'Perfect, thank you!',
          ai: 'You\'re welcome, John! Is there anything else I can help you with today?'
        },
        {
          user: 'No, that\'s all for now. Have a great day!',
          ai: 'You too, John! Feel free to reach out anytime you have questions or concerns. Take care!'
        }
      ]
    }
  },
  {
    name: 'Sarah Johnson',
    phone: '+15552345678',
    email: 'sarah.johnson@example.com',
    property: {
      address: '456 Oak Avenue',
      owner_name: 'Bob Williams',
      owner_email: 'bob.williams@property.com',
      owner_phone: '+15558765432',
      amenities: {
        parking: true,
        gym: false,
        pool: true,
        laundry: 'building'
      },
      rules: {
        quiet_hours: '9pm - 8am',
        pet_policy: 'cats allowed with deposit',
        smoking_policy: 'designated areas only'
      }
    },
    lease_terms: {
      start_date: '2024-02-01',
      end_date: '2025-01-31',
      rent: 1800,
      due_date: 1
    },
    move_in_date: '2024-02-01',
    thread: {
      subject: 'Property questions and maintenance requests',
      channel: 'sms',
      messages: [
        {
          user: 'Hello! I just moved in and have a few questions',
          ai: 'Welcome to 456 Oak Avenue, Sarah! I\'m happy to help with any questions you have. What would you like to know?'
        },
        {
          user: 'Where can I find the laundry facilities?',
          ai: 'The laundry facilities are located on the ground floor, near the elevator. They\'re accessible 24/7 with your building key.'
        },
        {
          user: 'Great! Also, is the pool heated?',
          ai: 'Yes, the pool is heated and maintained year-round. Pool hours are 6am to 10pm daily. Enjoy!'
        },
        {
          user: 'I think I smell gas in the kitchen! What should I do?',
          ai: 'This is an emergency! Please evacuate the apartment immediately and do not use any electrical switches or open flames. I\'ve alerted the property manager and emergency services. Wait outside the building!',
          emergency: true,
          emergency_description: 'Gas leak detected in kitchen - immediate evacuation required'
        },
        {
          user: 'I\'m outside now. The gas company is on their way',
          ai: 'Stay safe, Sarah! The property manager has been notified and will coordinate with the gas company. Please don\'t re-enter until it\'s been cleared by professionals.'
        },
        {
          user: 'They gave the all-clear. It was a small leak from the stove',
          ai: 'That\'s a relief! A technician will inspect and repair the stove tomorrow to prevent this from happening again. Thank you for reporting it so quickly!'
        },
        {
          user: 'Also, the light fixture in the bedroom isn\'t working',
          ai: 'I\'ve created a maintenance request for the bedroom light fixture. Is it completely not working, or does it flicker sometimes?',
          normal: true,
          normal_description: 'Bedroom light fixture not working'
        },
        {
          user: 'It doesn\'t turn on at all. I tried changing the bulb but no luck',
          ai: 'Thanks for that detail. It sounds like it could be a wiring issue. A maintenance technician will check it out within the next few days. In the meantime, please use a lamp if you need extra lighting.'
        },
        {
          user: 'Can I have a cat? I saw in the rules that cats are allowed',
          ai: 'Yes, cats are allowed with a pet deposit of $300. You\'ll need to sign a pet addendum to your lease. Would you like me to send you the pet application form?'
        },
        {
          user: 'Yes please, that would be great!',
          ai: 'Perfect! I\'ll forward the pet application form to your email. Once you complete it and pay the deposit, you can welcome your furry friend home!'
        }
      ]
    }
  },
  {
    name: 'Michael Davis',
    phone: '+15553456789',
    email: 'michael.davis@example.com',
    property: {
      address: '789 Pine Road',
      owner_name: 'Carol Brown',
      owner_email: 'carol.brown@property.com',
      owner_phone: '+15557654321',
      amenities: {
        parking: false,
        gym: true,
        pool: false,
        laundry: 'in-unit'
      },
      rules: {
        quiet_hours: '11pm - 6am',
        pet_policy: 'no pets',
        smoking_policy: 'no smoking in building'
      }
    },
    lease_terms: {
      start_date: '2024-03-01',
      end_date: '2025-02-28',
      rent: 1650,
      due_date: 5
    },
    move_in_date: '2024-03-01',
    thread: {
      subject: 'Lease questions and maintenance',
      channel: 'sms',
      messages: [
        {
          user: 'Hi, I have a question about my lease',
          ai: 'Hello Michael! I\'m here to help. What would you like to know about your lease?'
        },
        {
          user: 'Can I sublet my apartment for a month this summer?',
          ai: 'According to your lease terms, subletting is not permitted without prior written approval from the property owner. I can forward your request to the property manager for consideration. How long would you need to sublet for?'
        },
        {
          user: 'Just for July. I\'ll ask the manager directly',
          ai: 'That sounds like a good plan, Michael. The property manager can discuss the options with you. Is there anything else I can help with?'
        },
        {
          user: 'Actually, there\'s no heat in my apartment and it\'s freezing!',
          ai: 'This is an emergency! I\'ve immediately notified the property manager and created an urgent maintenance request. Please check your thermostat first - is it set to heat and above 68°F?',
          emergency: true,
          emergency_description: 'No heat in apartment during winter - urgent repair needed'
        },
        {
          user: 'Thermostat is set to 72 but still cold. The furnace isn\'t running',
          ai: 'Thank you for checking. A heating technician has been dispatched with priority status. They should arrive within 2 hours. In the meantime, please use extra blankets and space heaters if available. Do not use your oven for heating!'
        },
        {
          user: 'Technician is here and fixing it now',
          ai: 'Excellent! Thank you for the update. The technician should have it working shortly. I\'ll follow up with you in an hour to make sure everything is resolved.'
        },
        {
          user: 'Heat is back on now. Thanks for the quick help!',
          ai: 'I\'m so glad to hear that, Michael! The heat is now working properly. Is there anything else you need assistance with?'
        },
        {
          user: 'One more thing - the garbage disposal is jammed',
          ai: 'I\'ve logged a maintenance request for the garbage disposal. Before a technician comes, try pressing the reset button on the bottom of the disposal unit. Have you tried that?',
          normal: true,
          normal_description: 'Garbage disposal jammed'
        },
        {
          user: 'Yes, I tried the reset button but it still doesn\'t work',
          ai: 'Thanks for trying that. It sounds like there might be an obstruction or mechanical issue. A maintenance technician will inspect and repair it within the next few days. Please avoid putting any food down it until it\'s fixed.'
        },
        {
          user: 'Got it. Thanks for all your help today!',
          ai: 'You\'re very welcome, Michael! I\'m glad we could get the heat working quickly. Don\'t hesitate to reach out if you need anything else. Stay warm!'
        }
      ]
    }
  }
];

async function seedTestData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting test data seeding...');

    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing test data...');
    await client.query('DELETE FROM maintenance_requests WHERE tenant_id IN (SELECT id FROM tenants WHERE phone LIKE $1)', ['+1555%']);
    await client.query('DELETE FROM messages WHERE thread_id IN (SELECT id FROM conversation_threads WHERE tenant_id IN (SELECT id FROM tenants WHERE phone LIKE $1))', ['+1555%']);
    await client.query('DELETE FROM conversation_threads WHERE tenant_id IN (SELECT id FROM tenants WHERE phone LIKE $1)', ['+1555%']);
    await client.query('DELETE FROM tenants WHERE phone LIKE $1', ['+1555%']);
    await client.query('DELETE FROM properties WHERE address LIKE ANY($1)', [['123 Main Street', '456 Oak Avenue', '789 Pine Road']]);

    let totalTenants = 0;
    let totalThreads = 0;
    let totalMessages = 0;
    let totalMaintenanceRequests = 0;

    // Create tenants, properties, threads, messages, and maintenance requests
    for (const tenantData of tenantsData) {
      console.log(`\nProcessing tenant: ${tenantData.name}`);

      // 1. Create property
      const propertyResult = await client.query(
        `INSERT INTO properties (address, owner_name, owner_email, owner_phone, amenities, rules)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          tenantData.property.address,
          tenantData.property.owner_name,
          tenantData.property.owner_email,
          tenantData.property.owner_phone,
          JSON.stringify(tenantData.property.amenities),
          JSON.stringify(tenantData.property.rules)
        ]
      );
      const propertyId = propertyResult.rows[0].id;
      console.log(`  ✓ Created property: ${tenantData.property.address} (ID: ${propertyId})`);

      // 2. Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (property_id, name, phone, email, lease_terms, move_in_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          propertyId,
          tenantData.name,
          tenantData.phone,
          tenantData.email,
          JSON.stringify(tenantData.lease_terms),
          tenantData.move_in_date
        ]
      );
      const tenantId = tenantResult.rows[0].id;
      console.log(`  ✓ Created tenant: ${tenantData.name} (ID: ${tenantId})`);
      totalTenants++;

      // 3. Create conversation thread
      const threadResult = await client.query(
        `INSERT INTO conversation_threads (tenant_id, property_id, subject, status, channel)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          tenantId,
          propertyId,
          tenantData.thread.subject,
          'resolved',
          tenantData.thread.channel
        ]
      );
      const threadId = threadResult.rows[0].id;
      console.log(`  ✓ Created conversation thread: "${tenantData.thread.subject}" (ID: ${threadId})`);
      totalThreads++;

      // 4. Create messages (10 messages = 5 user + 5 AI responses)
      let messageIndex = 0;
      for (const msg of tenantData.thread.messages) {
        // Create user message
        const userMsgResult = await client.query(
          `INSERT INTO messages (thread_id, tenant_id, channel, message, response, message_type, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${(10 - messageIndex) * 2} hours')
           RETURNING id`,
          [
            threadId,
            tenantId,
            tenantData.thread.channel,
            msg.user,
            msg.ai,
            'user_message'
          ]
        );
        const userMsgId = userMsgResult.rows[0].id;

        // Create maintenance request if this message has one
        if (msg.emergency) {
          const maintResult = await client.query(
            `INSERT INTO maintenance_requests (property_id, tenant_id, message_id, issue_description, priority, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              propertyId,
              tenantId,
              userMsgId,
              msg.emergency_description,
              'emergency',
              'resolved'
            ]
          );
          console.log(`  ✓ Created emergency maintenance request: "${msg.emergency_description}" (ID: ${maintResult.rows[0].id})`);
          totalMaintenanceRequests++;
        }

        if (msg.normal) {
          const maintResult = await client.query(
            `INSERT INTO maintenance_requests (property_id, tenant_id, message_id, issue_description, priority, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              propertyId,
              tenantId,
              userMsgId,
              msg.normal_description,
              'normal',
              'open'
            ]
          );
          console.log(`  ✓ Created normal maintenance request: "${msg.normal_description}" (ID: ${maintResult.rows[0].id})`);
          totalMaintenanceRequests++;
        }

        messageIndex++;
        totalMessages++;
      }
      console.log(`  ✓ Created ${messageIndex} messages in thread`);
    }

    await client.query('COMMIT');

    console.log('\n✅ Test data seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Tenants created: ${totalTenants}`);
    console.log(`  - Conversation threads created: ${totalThreads}`);
    console.log(`  - Messages created: ${totalMessages}`);
    console.log(`  - Maintenance requests created: ${totalMaintenanceRequests}`);
    console.log('\nTest data is ready for use!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedTestData().catch(console.error);
