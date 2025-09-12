// Node 1: Quick Search Node - Returns in 1-2 seconds
// Purpose: Provides instant search results with metadata for AI to understand available documents

const axios = require('axios');

// Get input from n8n
const userQuery = $input.first().json.query || "";

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

// Perform quick metadata search
async function performQuickSearch() {
    try {
        const searchBody = {
            search: searchQuery,
            searchMode: "all",
            queryType: "simple", // Simple for maximum speed
            top: 5,
            select: "id,title,department,type,version,description,keywords",
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
                timeout: 2000 // 2 second timeout for ultra-fast response
            }
        );

        if (response.data && response.data.value && response.data.value.length > 0) {
            const results = response.data.value;
            const totalCount = response.data['@odata.count'] || results.length;
            
            // Build display HTML
            let displayHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <h2 style="color: #333; font-size: 1.2em; margin: 8px 0;">
                        📚 Found ${totalCount} document${totalCount !== 1 ? 's' : ''} for "${userQuery}"
                    </h2>
            `;
            
            results.forEach((doc, index) => {
                displayHtml += `
                    <div style="border: 1px solid #e0e0e0; padding: 8px; margin: 6px 0; border-radius: 4px; background: #fafafa;">
                        <div style="font-weight: 500; color: #0066cc; font-size: 0.95em;">
                            ${index + 1}. ${doc.title || 'Untitled'}
                        </div>
                        <div style="font-size: 0.8em; color: #666; margin: 2px 0;">
                            ${doc.department || 'General'} | ${doc.type || 'Document'} | v${doc.version || '1.0'}
                        </div>
                        <div style="font-size: 0.85em; margin: 4px 0;">
                            ${doc.description ? doc.description.substring(0, 150) + (doc.description.length > 150 ? '...' : '') : 'No description'}
                        </div>
                        ${doc.keywords ? `<div style="font-size: 0.75em; color: #888;">Tags: ${doc.keywords.substring(0, 100)}</div>` : ''}
                    </div>
                `;
            });
            
            displayHtml += `
                    <p style="font-size: 0.8em; color: #666; margin-top: 8px; font-style: italic;">
                        ℹ️ Ask me specific questions about these documents for detailed answers.
                    </p>
                </div>
            `;
            
            // Return structured data for AI and display
            return {
                json: {
                    success: true,
                    query: userQuery,
                    totalCount: totalCount,
                    resultCount: results.length,
                    displayHtml: displayHtml,
                    documents: results.map(doc => ({
                        id: doc.id,
                        title: doc.title,
                        department: doc.department,
                        type: doc.type,
                        version: doc.version,
                        description: doc.description,
                        keywords: doc.keywords
                    })),
                    aiInstruction: "These are the available documents. If the user asks specific questions about any document, use Node 2 to fetch the full content.",
                    timestamp: new Date().toISOString()
                }
            };
            
        } else {
            // No results found
            return {
                json: {
                    success: true,
                    query: userQuery,
                    totalCount: 0,
                    resultCount: 0,
                    displayHtml: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px;">
                            <h2 style="color: #333; font-size: 1.2em;">No Documents Found</h2>
                            <p style="font-size: 0.9em;">No documents matched "${userQuery}".</p>
                            <p style="font-size: 0.85em; color: #666;">Try different keywords or search for "all" to see all documents.</p>
                        </div>
                    `,
                    documents: [],
                    timestamp: new Date().toISOString()
                }
            };
        }
        
    } catch (error) {
        // Return error but gracefully
        return {
            json: {
                success: false,
                error: error.message,
                query: userQuery,
                displayHtml: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px;">
                        <h2 style="color: #c00; font-size: 1.2em;">Search Temporarily Unavailable</h2>
                        <p style="font-size: 0.9em;">Please try again in a moment.</p>
                    </div>
                `,
                documents: [],
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Execute and return
return performQuickSearch();