const https = require('https');
const { URL } = require('url');

module.exports = async function (context, req) {
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

    const targetUrl = 'https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog';
    
    // Build URL with query parameters
    const url = new URL(targetUrl);
    if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
            url.searchParams.append(key, value);
        }
    }

    const makeRequest = () => new Promise((resolve, reject) => {
        const options = {
            method: req.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MegaMind-Proxy/1.0'
            }
        };

        const request = https.request(url.toString(), options, (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
                resolve({
                    status: response.statusCode,
                    headers: response.headers,
                    body: data
                });
            });
        });

        request.on('error', (error) => {
            console.error('Proxy request error:', error);
            reject(error);
        });

        // Send body if it's a POST request
        if (req.method === 'POST' && req.body) {
            request.write(JSON.stringify(req.body));
        }

        request.end();
    });

    try {
        const result = await makeRequest();
        
        context.res = {
            status: result.status || 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Content-Type': result.headers['content-type'] || 'application/json'
            },
            body: result.body
        };
    } catch (error) {
        console.error('Proxy error:', error);
        context.res = {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Proxy request failed', details: error.message })
        };
    }
};