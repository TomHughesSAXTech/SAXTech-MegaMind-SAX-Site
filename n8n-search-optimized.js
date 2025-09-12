// Optimized Azure Cognitive Search Tool for n8n with Faster Response
// This version prioritizes speed while maintaining contextual information

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

// Function to truncate text efficiently
function truncateText(text, maxLength = 300) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

// Function to extract key sentences (faster than full content)
function extractKeyContext(content, query, maxLength = 500) {
    if (!content) return "";
    
    // If query is wildcard, just return beginning
    if (query === "*") {
        return truncateText(content, maxLength);
    }
    
    // Find relevant section containing query terms
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    const sentences = content.split(/[.!?]+/);
    let relevantSentences = [];
    
    for (let sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        for (let term of queryTerms) {
            if (lowerSentence.includes(term)) {
                relevantSentences.push(sentence.trim());
                if (relevantSentences.join('. ').length > maxLength) {
                    break;
                }
            }
        }
        if (relevantSentences.join('. ').length > maxLength) {
            break;
        }
    }
    
    return relevantSentences.length > 0 ? 
           relevantSentences.join('. ').substring(0, maxLength) : 
           truncateText(content, maxLength);
}

async function performSearch() {
    try {
        // Optimized search body - only get essential fields initially
        const searchBody = {
            search: searchQuery,
            searchMode: "all",
            queryType: "semantic",
            semanticConfiguration: "default",
            top: 3, // Reduced from 5 to speed up
            select: "id,title,department,type,version,description,keywords,extractedText", // Removed full content field
            highlightFields: "description,keywords",
            highlight: true,
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
                timeout: 10000 // 10 second timeout
            }
        );

        if (response.data && response.data.value && response.data.value.length > 0) {
            const results = response.data.value;
            let formattedResults = [];
            let aiContext = [];
            
            // Process results with optimized content extraction
            for (let i = 0; i < results.length; i++) {
                const doc = results[i];
                const score = doc['@search.score'] || 0;
                const rerankerScore = doc['@search.rerankerScore'] || null;
                
                // Extract key context from extractedText (faster than full content)
                const contextSnippet = extractKeyContext(
                    doc.extractedText || doc.description || "", 
                    userQuery, 
                    400
                );
                
                // Build simplified result card
                let resultHtml = `
                    <div style="border: 1px solid #ddd; padding: 12px; margin: 10px 0; border-radius: 6px;">
                        <h3 style="color: #0066cc; margin: 0 0 8px 0;">${doc.title || 'Untitled'}</h3>
                        <div style="color: #666; font-size: 0.9em; margin-bottom: 8px;">
                            <span><strong>Department:</strong> ${doc.department || 'N/A'}</span> | 
                            <span><strong>Type:</strong> ${doc.type || 'N/A'}</span> | 
                            <span><strong>Version:</strong> ${doc.version || 'N/A'}</span>
                        </div>
                        <p style="margin: 8px 0;"><strong>Description:</strong> ${doc.description || 'No description available'}</p>
                        ${contextSnippet ? `<p style="margin: 8px 0; padding: 8px; background: #f5f5f5; border-left: 3px solid #0066cc;"><strong>Relevant Content:</strong> ${contextSnippet}</p>` : ''}
                        ${doc.keywords ? `<p style="margin: 8px 0; color: #555;"><strong>Keywords:</strong> ${doc.keywords}</p>` : ''}
                    </div>
                `;
                
                formattedResults.push(resultHtml);
                
                // Add to AI context (limited to essential info)
                aiContext.push({
                    title: doc.title,
                    department: doc.department,
                    type: doc.type,
                    description: doc.description,
                    relevantContent: contextSnippet,
                    keywords: doc.keywords
                });
            }
            
            // Build final response
            let finalHtml = `
                <div style="font-family: Arial, sans-serif;">
                    <h2 style="color: #333;">Search Results for "${userQuery}"</h2>
                    <p style="color: #666;">Found ${response.data['@odata.count'] || results.length} matching documents</p>
                    ${formattedResults.join('')}
                    <!-- AI Context (Hidden) -->
                    <div style="display: none;" data-ai-context='${JSON.stringify(aiContext)}'></div>
                </div>
            `;
            
            return {
                json: {
                    success: true,
                    query: userQuery,
                    resultsCount: results.length,
                    totalCount: response.data['@odata.count'] || results.length,
                    html: finalHtml,
                    aiContext: aiContext, // Structured data for AI to use
                    timestamp: new Date().toISOString()
                }
            };
        } else {
            // No results found
            return {
                json: {
                    success: true,
                    query: userQuery,
                    resultsCount: 0,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2 style="color: #333;">No Results Found</h2>
                            <p>No documents matched your search for "${userQuery}".</p>
                            <p style="color: #666;">Try using different keywords or search for "all" to see all documents.</p>
                        </div>
                    `,
                    aiContext: [],
                    timestamp: new Date().toISOString()
                }
            };
        }
        
    } catch (error) {
        // Fallback to simpler search if semantic search fails
        if (error.response && error.response.status === 400) {
            try {
                const fallbackBody = {
                    search: searchQuery,
                    searchMode: "all",
                    queryType: "simple",
                    top: 3,
                    select: "id,title,department,type,description",
                    count: true
                };
                
                const fallbackResponse = await axios.post(
                    searchEndpoint,
                    fallbackBody,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'api-key': apiKey
                        },
                        timeout: 5000 // Shorter timeout for fallback
                    }
                );
                
                if (fallbackResponse.data && fallbackResponse.data.value) {
                    const results = fallbackResponse.data.value;
                    let formattedResults = results.map(doc => `
                        <div style="border: 1px solid #ddd; padding: 10px; margin: 8px 0; border-radius: 4px;">
                            <h3 style="color: #0066cc; margin: 0 0 5px 0;">${doc.title || 'Untitled'}</h3>
                            <p style="margin: 5px 0; color: #666;"><strong>Department:</strong> ${doc.department || 'N/A'} | <strong>Type:</strong> ${doc.type || 'N/A'}</p>
                            <p style="margin: 5px 0;">${truncateText(doc.description || 'No description', 200)}</p>
                        </div>
                    `).join('');
                    
                    return {
                        json: {
                            success: true,
                            query: userQuery,
                            resultsCount: results.length,
                            html: `
                                <div style="font-family: Arial, sans-serif;">
                                    <h2 style="color: #333;">Search Results (Basic Search)</h2>
                                    <p style="color: #666;">Found ${results.length} documents</p>
                                    ${formattedResults}
                                </div>
                            `,
                            aiContext: results.map(doc => ({
                                title: doc.title,
                                department: doc.department,
                                type: doc.type,
                                description: doc.description
                            })),
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            } catch (fallbackError) {
                // Fallback also failed
            }
        }
        
        // Return error message
        return {
            json: {
                success: false,
                error: error.message || 'Search failed',
                query: userQuery,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #d00;">Search Error</h2>
                        <p>Unable to perform search. Please try again later.</p>
                        <p style="color: #666; font-size: 0.9em;">Error: ${error.message || 'Unknown error'}</p>
                    </div>
                `,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Execute search and return results
return performSearch();