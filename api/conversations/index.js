const fetch = require('node-fetch');

module.exports = async function (context, req) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            }
        };
        return;
    }
    
    const { method, body, query } = req;
    
    // Build query string from request query parameters
    const queryString = new URLSearchParams(query).toString();
    const targetUrl = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog${queryString ? '?' + queryString : ''}`;
    
    context.log(`Proxying ${method} request to: ${targetUrl}`);
    
    try {
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
        context.log(`Response data preview: ${responseData.substring(0, 200)}`);
        
        // Try to parse as JSON to set correct content type
        let isJson = false;
        try {
            JSON.parse(responseData);
            isJson = true;
        } catch (e) {
            // Not JSON, that's fine
        }
        
        // Set CORS headers
        context.res = {
            status: response.status,
            headers: {
                'Content-Type': isJson ? 'application/json' : (response.headers.get('content-type') || 'text/plain'),
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
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: JSON.stringify({ error: 'Proxy error: ' + error.message })
        };
    }
};
