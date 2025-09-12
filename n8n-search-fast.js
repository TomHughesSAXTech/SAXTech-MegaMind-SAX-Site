// Ultra-Fast Azure Cognitive Search Tool for n8n
// Two-stage approach: Quick metadata first, full content on demand

const axios = require('axios');

// Get input from n8n
const userQuery = $input.first().json.query || "";
const loadFullContent = $input.first().json.loadFullContent || false; // Flag to load full content
const documentIds = $input.first().json.documentIds || []; // Specific doc IDs to load content for

// Azure Search configuration
const searchServiceName = "saxsearchservice";
const indexName = "sop-documents";
const apiKey = "zQGGU5DqLHajy0a0RfLvbdW8eVMoy7oQpd3nqn9VAzSeBa0Jmjb";
const searchEndpoint = `https://${searchServiceName}.search.windows.net/indexes/${indexName}/docs/search?api-version=2024-05-01-preview`;

// Convert user query to search query
let searchQuery = userQuery.toLowerCase();
if (searchQuery === "all" || searchQuery === "all documents" || searchQuery === "*") {
    searchQuery = "*";
}

// Stage 1: Quick metadata search (should return in 1-2 seconds)
async function quickSearch() {
    try {
        const searchBody = {
            search: searchQuery,
            searchMode: "all",
            queryType: "simple", // Use simple for speed
            top: 5,
            select: "id,title,department,type,version,description,keywords", // Minimal fields
            count: true
        };

        const response = await axios.post(
            searchEndpoint,
            searchBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                timeout: 3000 // 3 second timeout for quick response
            }
        );

        if (response.data && response.data.value && response.data.value.length > 0) {
            const results = response.data.value;
            
            // Build quick response cards
            let resultCards = results.map((doc, index) => `
                <div style="border: 1px solid #ddd; padding: 10px; margin: 8px 0; border-radius: 5px; background: #fff;">
                    <h3 style="color: #0066cc; margin: 0 0 5px 0; font-size: 1.1em;">
                        ${index + 1}. ${doc.title || 'Untitled Document'}
                    </h3>
                    <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">
                        ${doc.department || 'General'} • ${doc.type || 'Document'} • v${doc.version || '1.0'}
                    </div>
                    <p style="margin: 5px 0; font-size: 0.95em;">
                        ${doc.description || 'No description available'}
                    </p>
                    ${doc.keywords ? `<div style="font-size: 0.85em; color: #888; margin-top: 5px;">Tags: ${doc.keywords}</div>` : ''}
                    <div style="display: none;" data-doc-id="${doc.id}"></div>
                </div>
            `).join('');
            
            // Prepare AI context with essential info
            const aiQuickContext = results.map(doc => ({
                id: doc.id,
                title: doc.title,
                department: doc.department,
                type: doc.type,
                version: doc.version,
                description: doc.description,
                keywords: doc.keywords
            }));
            
            return {
                json: {
                    success: true,
                    stage: 'quick',
                    query: userQuery,
                    resultsCount: results.length,
                    totalCount: response.data['@odata.count'] || results.length,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            <h2 style="color: #333; font-size: 1.3em; margin: 10px 0;">📚 Found ${results.length} Documents</h2>
                            ${resultCards}
                            <p style="font-size: 0.85em; color: #666; margin-top: 10px; font-style: italic;">
                                💡 AI can now answer questions about these documents. For detailed content, please specify which document you need.
                            </p>
                        </div>
                    `,
                    documents: aiQuickContext,
                    message: "Quick search completed. For detailed content, the AI can request specific documents.",
                    timestamp: new Date().toISOString()
                }
            };
        } else {
            return {
                json: {
                    success: true,
                    stage: 'quick',
                    query: userQuery,
                    resultsCount: 0,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 15px;">
                            <h2 style="color: #333;">No Documents Found</h2>
                            <p>No documents matched "${userQuery}".</p>
                        </div>
                    `,
                    documents: [],
                    timestamp: new Date().toISOString()
                }
            };
        }
        
    } catch (error) {
        return {
            json: {
                success: false,
                stage: 'quick',
                error: error.message || 'Quick search failed',
                query: userQuery,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 15px;">
                        <h2 style="color: #d00;">Search Error</h2>
                        <p>Unable to perform search. Please try again.</p>
                    </div>
                `,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Stage 2: Load full content for specific documents (called only when needed)
async function loadDocumentContent(docIds) {
    try {
        // Build filter for specific document IDs
        const filter = docIds.map(id => `id eq '${id}'`).join(' or ');
        
        const searchBody = {
            search: "*",
            filter: filter,
            select: "id,title,content,extractedText",
            top: docIds.length
        };
        
        const response = await axios.post(
            searchEndpoint,
            searchBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                timeout: 10000 // 10 seconds for content loading
            }
        );
        
        if (response.data && response.data.value) {
            const documents = response.data.value.map(doc => ({
                id: doc.id,
                title: doc.title,
                content: doc.content || doc.extractedText || "Content not available"
            }));
            
            return {
                json: {
                    success: true,
                    stage: 'content',
                    documentsWithContent: documents,
                    timestamp: new Date().toISOString()
                }
            };
        }
        
    } catch (error) {
        return {
            json: {
                success: false,
                stage: 'content',
                error: error.message || 'Failed to load document content',
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Main execution logic
if (loadFullContent && documentIds.length > 0) {
    // Stage 2: Load specific document content
    return loadDocumentContent(documentIds);
} else {
    // Stage 1: Quick search
    return quickSearch();
}