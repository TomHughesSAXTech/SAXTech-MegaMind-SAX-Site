#!/usr/bin/env node

// Simple webhook test script to verify n8n payload structure
async function testWebhook() {
    const testPayload = {
        chatInput: "Hello, this is a test message",
        message: "Hello, this is a test message",
        input: "Hello, this is a test message",
        prompt: "Hello, this is a test message",
        text: "Hello, this is a test message",
        query: "Hello, this is a test message",
        sessionId: 'test_session_' + Date.now(),
        selectedVoice: 'alloy',
        timestamp: new Date().toISOString(),
        userContext: {
            userProfile: {
                name: 'Test User',
                email: 'test@saxtechnology.com',
                jobTitle: 'Developer',
                department: 'SAX Technology'
            },
            source: 'test-script',
            version: '1.0'
        }
    };

    console.log('🧪 Testing webhook payload...');
    console.log('📦 Payload being sent:');
    console.log(JSON.stringify(testPayload, null, 2));
    console.log('\n🌐 Sending to webhook...');

    try {
        const response = await fetch('https://workflows.saxtechnology.com/webhook/megamind-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'MegaMind-Test-Script/1.0'
            },
            body: JSON.stringify(testPayload)
        });

        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        console.log('📋 Response Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }

        if (response.ok) {
            try {
                const result = await response.json();
                console.log('\n✅ Success! Response data:');
                console.log(JSON.stringify(result, null, 2));
            } catch (e) {
                console.log('\n✅ Success! But could not parse JSON response.');
                console.log('Error:', e.message);
            }
        } else {
            try {
                const errorText = await response.text();
                console.log('\n❌ Error response:');
                console.log(errorText);
                
                // Try to parse as JSON if possible
                try {
                    const errorJson = JSON.parse(errorText);
                    console.log('\n🔍 Parsed error details:');
                    console.log(JSON.stringify(errorJson, null, 2));
                } catch (e) {
                    console.log('(Could not parse as JSON)');
                }
            } catch (e) {
                console.log('\n❌ Error reading response body:', e.message);
            }
        }

    } catch (error) {
        console.error('\n💥 Network/Fetch Error:');
        console.error(error.message);
    }
}

// Run the test
testWebhook();
