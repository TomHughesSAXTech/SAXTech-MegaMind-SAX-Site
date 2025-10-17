// Admin CORS Fallback - Temporary fix for conversations API
// This file provides a fallback mechanism when the Azure Static Web Apps proxy is not working

console.log('Admin CORS Fallback loaded');

// Store the original fetch function
const originalFetch = window.fetch;

// Override fetch to intercept /api/conversations calls
window.fetch = function(...args) {
    const [url, options = {}] = args;
    
    // Check if this is a call to our conversations API
    if (typeof url === 'string' && url.includes('/api/conversations')) {
        console.log('Intercepting conversations API call:', url);
        
        // Extract query parameters from the URL
        const urlParts = url.split('?');
        const queryString = urlParts.length > 1 ? urlParts[1] : '';
        
        // Build the external API URL
        const externalUrl = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog${queryString ? '?' + queryString : ''}`;
        console.log('Redirecting to external API:', externalUrl);
        
        // For POST requests, we need to handle the body
        if (options.method === 'POST' && options.body) {
            // Parse the body to get the action and data
            let parsedBody;
            try {
                parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
                
                // Convert POST data to query parameters for the external API
                const params = new URLSearchParams();
                Object.keys(parsedBody).forEach(key => {
                    if (parsedBody[key] !== undefined && parsedBody[key] !== null) {
                        params.append(key, typeof parsedBody[key] === 'object' ? JSON.stringify(parsedBody[key]) : parsedBody[key]);
                    }
                });
                
                const finalUrl = `${externalUrl}${externalUrl.includes('?') ? '&' : '?'}${params.toString()}`;
                console.log('POST converted to GET with params:', finalUrl);
                
                // Make it a GET request since the external API expects query parameters
                return originalFetch(finalUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
            } catch (e) {
                console.error('Error parsing POST body:', e);
                // Fallback to original POST request
                return originalFetch(externalUrl, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Accept': 'application/json'
                    }
                });
            }
        } else {
            // For GET requests, just redirect to the external URL
            return originalFetch(externalUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
        }
    }
    
    // For all other calls, use the original fetch
    return originalFetch.apply(this, args);
};

// Test the API connection
setTimeout(async () => {
    try {
        console.log('Testing fallback API connection...');
        const testResponse = await fetch('/api/conversations?action=recent&limit=1');
        console.log('Test response status:', testResponse.status);
        
        if (testResponse.ok) {
            const testData = await testResponse.text();
            console.log('Test response preview:', testData.substring(0, 100));
            
            if (!testData.includes('<!DOCTYPE') && !testData.includes('<html')) {
                try {
                    const jsonData = JSON.parse(testData);
                    console.log('✅ CORS Fallback working! API test successful');
                    
                    // Show a success indicator in the UI
                    const statusElement = document.getElementById('tokenApiStatus');
                    if (statusElement) {
                        statusElement.innerHTML = '<span style="color: #16a34a; font-size: 12px;">✅ API Connected</span>';
                    }
                } catch (e) {
                    console.log('⚠️ API responding but not valid JSON');
                }
            } else {
                console.log('❌ Still getting HTML response from API');
            }
        } else {
            console.log('❌ API test failed with status:', testResponse.status);
        }
    } catch (error) {
        console.error('API test error:', error);
    }
}, 2000);