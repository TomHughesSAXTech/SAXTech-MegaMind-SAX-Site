module.exports = async function (context, req) {
    const https = require('https');
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
    };
    
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: ''
        };
        return;
    }
    
    try {
        const searchEndpoint = 'https://saxmegamind-search.search.windows.net';
        const apiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
        const indexName = 'sop-documents';
        
        const { query = '*', top = 1000 } = req.body || {};
        
        const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs?api-version=2023-11-01&search=${encodeURIComponent(query)}&$top=${top}&$select=id,content,title,metadata_storage_name,metadata_storage_path,metadata_storage_last_modified,uploadDate`;
        
        // Make direct call to Azure Search
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Azure Search failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: data
        };
        
    } catch (error) {
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: { error: error.message }
        };
    }
};