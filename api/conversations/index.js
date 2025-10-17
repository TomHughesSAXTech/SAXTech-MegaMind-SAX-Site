module.exports = async function (context, req) {
    const { method, headers, body, url } = req;
    
    // Extract query parameters from the original request
    const urlObj = new URL(url, `https://${headers.host}`);
    const queryString = urlObj.search;
    
    // Build the target URL with query parameters
    const targetUrl = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog${queryString}`;
    
    context.log(`Proxying ${method} request to: ${targetUrl}`);
    
    try {
        // Import fetch for Node.js environment
        const fetch = require('node-fetch');
        
        // Forward the request to the external API
        const response = await fetch(targetUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: method === 'POST' ? JSON.stringify(body) : undefined
        });
        
        const responseData = await response.text();
        
        context.log(`Response status: ${response.status}`);
        context.log(`Response data length: ${responseData.length}`);
        
        // Set CORS headers
        context.res = {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: responseData
        };
        
    } catch (error) {
        context.log.error('Proxy error:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Proxy error: ' + error.message })
        };
    }
};