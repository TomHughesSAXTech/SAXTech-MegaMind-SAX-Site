const { app } = require('@azure/functions');
const axios = require('axios');

// Azure Search configuration
const SEARCH_ENDPOINT = 'https://saxmegamind-search.search.windows.net';
const API_KEY = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
const API_VERSION = '2023-11-01';
const INDEX_NAME = 'sop-documents'; // Fixed: was 'sax-documents'
const SEMANTIC_CONFIG = 'sop-semantic-config'; // Fixed: proper semantic config

// Enhanced query generation for better search results
function generateEnhancedQueries(query) {
    const baseQuery = query.toLowerCase().trim();
    const enhancedQueries = [baseQuery];
    
    // Add common synonyms and variations for better semantic matching
    const queryMappings = {
        'smoking': ['tobacco', 'cigarette', 'vaping', 'nicotine'],
        'policy': ['procedure', 'rule', 'regulation', 'guideline'],
        'employee': ['staff', 'personnel', 'worker', 'team member'],
        'benefits': ['compensation', 'perks', 'package', 'rewards'],
        'crypto': ['cryptocurrency', 'bitcoin', 'digital currency', 'virtual currency'],
        'tax': ['taxation', 'IRS', 'revenue', 'filing'],
        'hubspot': ['CRM', 'customer management', 'sales platform'],
    };
    
    // Generate enhanced queries based on keywords
    Object.keys(queryMappings).forEach(keyword => {
        if (baseQuery.includes(keyword)) {
            queryMappings[keyword].forEach(synonym => {
                const enhancedQuery = baseQuery.replace(keyword, synonym);
                if (!enhancedQueries.includes(enhancedQuery)) {
                    enhancedQueries.push(enhancedQuery);
                }
            });
        }
    });
    
    return enhancedQueries;
}

// Format search results for optimal AI consumption
function formatSearchResults(results) {
    if (!results || !Array.isArray(results)) return [];
    
    return results.map((result, index) => {
        // Clean and format content
        let content = result.content || '';
        content = content
            .replace(/\r\n/g, '\n')
            .replace(/\n\n+/g, '\n\n')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Determine best source URL
        const sourceUrl = result.url || result.blobUrl || '';
        let sourceDomain = 'SAX Document';
        
        if (sourceUrl) {
            try {
                const urlObj = new URL(sourceUrl);
                sourceDomain = urlObj.hostname.replace('www.', '');
            } catch (e) {
                sourceDomain = 'SAX Document';
            }
        }
        
        // Format title
        const title = result.title || 'SAX Policy Document';
        
        return {
            rank: index + 1,
            title: title,
            content: content,
            sourceUrl: sourceUrl,
            sourceDomain: sourceDomain,
            score: result['@search.score'] || 0,
            highlights: result['@search.highlights'] || {},
            hasMore: content.length > 1500
        };
    });
}

app.http('semantic-search', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log('SAX Document Search request received');
            
            // Parse request body
            let query = '';
            if (request.method === 'POST') {
                const body = await request.json();
                query = body.query || '';
            } else {
                query = request.query.get('query') || '';
            }
            
            if (!query) {
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Query parameter required',
                        message: 'Please provide a search query'
                    }
                };
            }
            
            context.log(`Searching for: "${query}"`);
            
            // Generate enhanced queries for better results
            const enhancedQueries = generateEnhancedQueries(query);
            const searchQuery = enhancedQueries[0]; // Use primary query for search
            
            // Construct Azure Search request
            const searchUrl = `${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/search`;
            const searchBody = {
                search: searchQuery,
                queryType: 'semantic',
                semanticConfiguration: SEMANTIC_CONFIG,
                select: 'title,content,blobUrl,url,source',
                top: 10,
                highlight: 'title,content',
                highlightPreTag: '<mark>',
                highlightPostTag: '</mark>'
            };
            
            const searchConfig = {
                method: 'POST',
                url: searchUrl,
                params: {
                    'api-version': API_VERSION
                },
                headers: {
                    'api-key': API_KEY,
                    'Content-Type': 'application/json'
                },
                data: searchBody
            };
            
            context.log('Making Azure Search request...');
            
            // Execute search
            const searchResponse = await axios(searchConfig);
            const searchResults = searchResponse.data;
            
            // Format results for optimal consumption
            const formattedResults = formatSearchResults(searchResults.value || []);
            
            // Create comprehensive response
            const response = {
                success: true,
                query: query,
                enhancedQueries: enhancedQueries,
                index: INDEX_NAME,
                indexInfo: {
                    name: 'SAX Documents',
                    description: 'Company policies, procedures, and documentation',
                    semanticConfig: SEMANTIC_CONFIG
                },
                totalResults: formattedResults.length,
                results: formattedResults,
                searchMetadata: {
                    searchMode: 'semantic',
                    queryType: 'semantic',
                    enhanced: true,
                    searchTime: new Date().toISOString()
                }
            };
            
            context.log(`Search completed. Found ${formattedResults.length} results`);
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: response
            };
            
        } catch (error) {
            context.log.error('Search error:', error.message);
            
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Search failed',
                    message: error.message,
                    query: query || 'unknown'
                }
            };
        }
    }
});