const https = require('https');

module.exports = async function (context, req) {
    context.log('Document search function triggered');

    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-functions-key',
                'Access-Control-Max-Age': '3600'
            },
            body: ''
        };
        return;
    }

    try {
        // Get search parameters from request body
        const {
            search = '*',
            filter,
            select,
            top = 50,
            orderby,
            indexName = 'sop-documents'
        } = req.body || {};

        // Azure Search configuration
        const searchServiceName = 'saxmegamind-search';
        const searchApiKey = process.env.AZURE_SEARCH_API_KEY || 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
        const apiVersion = '2023-11-01';

        // Build the search request
        const searchRequest = {
            search: search,
            filter: filter,
            select: select,
            top: top,
            orderby: orderby,
            count: true,
            queryType: 'simple',
            searchMode: 'all'
        };

        // Remove undefined properties
        Object.keys(searchRequest).forEach(key => 
            searchRequest[key] === undefined && delete searchRequest[key]
        );

        context.log('Search request:', JSON.stringify(searchRequest));

        // Make request to Azure Search
        const options = {
            hostname: `${searchServiceName}.search.windows.net`,
            path: `/indexes/${indexName}/docs/search?api-version=${apiVersion}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': searchApiKey
            }
        };

        const searchResults = await makeHttpRequest(options, searchRequest);
        
        context.log(`Found ${searchResults['@odata.count'] || searchResults.value?.length || 0} documents`);

        // Return the search results
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
            },
            body: searchResults
        };

    } catch (error) {
        context.log.error('Search error:', error);
        
        context.res = {
            status: error.statusCode || 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                error: 'Search operation failed',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
    }
};

// Helper function to make HTTPS requests
function makeHttpRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        const error = new Error(parsed.error?.message || `Request failed with status ${res.statusCode}`);
                        error.statusCode = res.statusCode;
                        error.response = parsed;
                        reject(error);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${responseData}`));
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}
