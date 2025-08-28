#!/usr/bin/env node

// Test script to verify n8n webhook is receiving the correct data
const https = require('https');

// Test payload matching what our frontend sends
const testPayload = {
  chatInput: "Hello, test message",
  message: "Hello, test message",  // backward compatibility
  sessionId: "test_session_" + Date.now(),
  selectedVoice: "alloy",
  userContext: {},
  userProfile: {}
};

const options = {
  hostname: 'workflows.saxtechnology.com',
  port: 443,
  path: '/webhook/megamind-sax-chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(testPayload))
  }
};

console.log('Sending test payload to n8n webhook:');
console.log(JSON.stringify(testPayload, null, 2));

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse status:', res.statusCode);
    console.log('Response headers:', res.headers);
    console.log('\nResponse body:');
    
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.errorMessage) {
        console.log('\n❌ ERROR DETECTED:');
        console.log('Message:', parsed.errorMessage);
        console.log('Description:', parsed.errorDescription);
        console.log('\n💡 SOLUTION: The n8n workflow needs to pass "chatInput" field to the Megamind CORTEX agent node.');
      } else {
        console.log('\n✅ SUCCESS: Webhook is working correctly!');
      }
    } catch (e) {
      console.log('Raw response:', data);
      console.log('\n⚠️  WARNING: Response is not valid JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(JSON.stringify(testPayload));
req.end();
