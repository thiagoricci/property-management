async function testAnalytics() {
  try {
    // First, login to get token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.token) {
      console.error('Failed to login:', loginData);
      return;
    }

    console.log('✓ Login successful');
    console.log('Token:', loginData.token.substring(0, 20) + '...');

    // Test analytics endpoint
    const analyticsResponse = await fetch('http://localhost:3000/api/conversations/analytics', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    const analyticsData = await analyticsResponse.json();

    console.log('\n✓ Analytics endpoint response:');
    console.log(JSON.stringify(analyticsData, null, 2));

    // Verify structure
    if (analyticsData.total !== undefined && analyticsData.by_channel) {
      console.log('\n✓ Analytics data structure is correct');
      console.log(`\nTotal conversations: ${analyticsData.total}`);
      console.log(`SMS: ${analyticsData.by_channel.sms}`);
      console.log(`Email: ${analyticsData.by_channel.email}`);
      console.log(`Call: ${analyticsData.by_channel.call}`);
      console.log(`API: ${analyticsData.by_channel.api}`);
      console.log(`WhatsApp: ${analyticsData.by_channel.whatsapp}`);
      console.log(`Other: ${analyticsData.by_channel.other}`);
    } else {
      console.error('\n✗ Analytics data structure is incorrect');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAnalytics();
