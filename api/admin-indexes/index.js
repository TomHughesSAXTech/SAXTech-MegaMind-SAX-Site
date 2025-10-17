const https = require('https');

module.exports = async function (context, req) {
    context.log('Admin Indexes endpoint called');
    
    // Azure Search configuration
    const searchEndpoint = 'https://saxmegamind-search.search.windows.net';
    const searchApiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
    
    try {
        // Fetch indexes from Azure Cognitive Search
        const url = `${searchEndpoint}/indexes?api-version=2023-11-01`;
        
        const options = {
            method: 'GET',
            headers: {
                'api-key': searchApiKey,
                'Content-Type': 'application/json'
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        headers: res.headers
                    });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.end();
        });
        
        if (response.status === 200) {
            const searchData = JSON.parse(response.data);
            const indexes = searchData.value || [];
            
            // Format the response
            const indexList = indexes.map(idx => ({
                name: idx.name,
                label: idx.name,
                documentCount: idx.documentCount || 0
            }));
            
            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
                },
                body: {
                    indexes: indexList,
                    count: indexList.length,
                    timestamp: new Date().toISOString()
                }
            };
            
            context.log(`Successfully returned ${indexList.length} indexes:`, indexList.map(i => i.name).join(', '));
            
        } else {
            throw new Error(`Azure Search API returned status ${response.status}`);
        }
        
    } catch (error) {
        context.log.error('Error fetching indexes:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                error: 'Failed to fetch indexes',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
};