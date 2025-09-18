module.exports = async function (context, req) {
    context.log('Test function triggered');
    
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
    };
    
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }
    
    context.res = {
        status: 200,
        headers,
        body: {
            success: true,
            message: 'Test function is working!',
            timestamp: new Date().toISOString(),
            method: req.method,
            query: req.query,
            body: req.body
        }
    };
};