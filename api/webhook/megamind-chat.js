module.exports = async function (context, req) {
    context.log('MegaMind SAX webhook proxy called');

    // Set CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };

    // Handle OPTIONS request (CORS preflight)
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = '';
        return;
    }

    try {
        // Forward the request to n8n webhook
        const fetch = require('node-fetch');
        const n8nWebhookUrl = 'https://workflows.saxtechnology.com/webhook/megamind-chat';
        
        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.text();
        
        context.res.status = response.status;
        context.res.body = data;
        context.res.headers['Content-Type'] = 'application/json';
        
    } catch (error) {
        context.log.error('Error proxying to n8n:', error);
        context.res.status = 500;
        context.res.body = JSON.stringify({ 
            error: 'Failed to connect to MegaMind service',
            details: error.message 
        });
    }
};
