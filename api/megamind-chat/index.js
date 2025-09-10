const https = require('https');

module.exports = async function (context, req) {
    context.log('MegaMind SAX webhook proxy called');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: ''
        };
        return;
    }

    // Handle POST request
    if (req.method === 'POST') {
        return new Promise((resolve) => {
            const postData = JSON.stringify(req.body);
            
            const options = {
                hostname: 'workflows.saxtechnology.com',
                port: 443,
                path: '/webhook/megamind-chat',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';

                proxyRes.on('data', (chunk) => {
                    data += chunk;
                });

                proxyRes.on('end', () => {
                    context.res = {
                        status: proxyRes.statusCode,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type'
                        },
                        body: data
                    };
                    resolve();
                });
            });

            proxyReq.on('error', (error) => {
                context.log.error('Proxy error:', error);
                context.res = {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'Failed to connect to MegaMind service',
                        details: error.message 
                    })
                };
                resolve();
            });

            proxyReq.write(postData);
            proxyReq.end();
        });
    }

    // Default response for other methods
    context.res = {
        status: 405,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: 'Method not allowed'
    };
};
