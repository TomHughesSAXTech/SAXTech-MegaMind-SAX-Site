// Node 2: Content Fetcher Node - Gets full document content when needed
// Purpose: Fetches complete document content for AI to answer detailed questions

const axios = require('axios');

// Get input from n8n - can accept either single document or multiple
const input = $input.first().json;
const documentIds = input.documentIds || (input.documentId ? [input.documentId] : []);
const documentTitles = input.documentTitles || [];

// Azure Search configuration
const searchServiceName = "saxsearchservice";
const indexName = "sop-documents";
const apiKey = "zQGGU5DqLHajy0a0RfLvbdW8eVMoy7oQpd3nqn9VAzSeBa0Jmjb";
const searchEndpoint = `https://${searchServiceName}.search.windows.net/indexes/${indexName}/docs/search?api-version=2024-05-01-preview`;

// Function to fetch content by document IDs
async function fetchByIds(ids) {
    if (!ids || ids.length === 0) {
        throw new Error('No document IDs provided');
    }
    
    // Build filter for specific document IDs
    const filter = ids.map(id => `id eq '${id}'`).join(' or ');
    
    const searchBody = {
        search: "*",
        filter: filter,
        select: "id,title,department,type,version,content,extractedText,description,keywords",
        top: ids.length
    };
    
    return axios.post(
        searchEndpoint,
        searchBody,
        {
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            timeout: 8000 // 8 seconds for content fetch
        }
    );
}

// Function to fetch content by titles (fallback)
async function fetchByTitles(titles) {
    if (!titles || titles.length === 0) {
        throw new Error('No document titles provided');
    }
    
    // Search for documents by title
    const searchQuery = titles.map(title => `"${title}"`).join(' OR ');
    
    const searchBody = {
        search: searchQuery,
        searchMode: "all",
        queryType: "simple",
        select: "id,title,department,type,version,content,extractedText,description,keywords",
        top: titles.length * 2 // Get extra in case of partial matches
    };
    
    return axios.post(
        searchEndpoint,
        searchBody,
        {
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            timeout: 8000
        }
    );
}

// Main function to fetch document content
async function fetchDocumentContent() {
    try {
        let response;
        
        // Try to fetch by IDs first (more accurate)
        if (documentIds && documentIds.length > 0) {
            response = await fetchByIds(documentIds);
        } 
        // Fallback to titles if no IDs provided
        else if (documentTitles && documentTitles.length > 0) {
            response = await fetchByTitles(documentTitles);
        } 
        else {
            return {
                json: {
                    success: false,
                    error: 'No document identifiers provided',
                    message: 'Please provide either documentIds or documentTitles',
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        if (response.data && response.data.value && response.data.value.length > 0) {
            const documents = response.data.value;
            
            // Process and structure the content for AI
            const processedDocs = documents.map(doc => {
                // Get the actual content, preferring content over extractedText
                const fullContent = doc.content || doc.extractedText || "";
                
                // Extract key sections if content is very long
                const contentPreview = fullContent.length > 500 ? 
                    fullContent.substring(0, 500) + "..." : fullContent;
                
                return {
                    id: doc.id,
                    title: doc.title,
                    department: doc.department,
                    type: doc.type,
                    version: doc.version,
                    description: doc.description,
                    keywords: doc.keywords,
                    contentPreview: contentPreview,
                    fullContent: fullContent,
                    contentLength: fullContent.length
                };
            });
            
            // Build response with full content for AI
            const aiContext = processedDocs.map(doc => ({
                title: doc.title,
                department: doc.department,
                type: doc.type,
                content: doc.fullContent // Full content for AI processing
            }));
            
            // Build simple display for user
            let displayHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <p style="color: #0a84ff; font-size: 0.9em; margin: 5px 0;">
                        ✓ Loaded detailed content for ${documents.length} document${documents.length !== 1 ? 's' : ''}
                    </p>
            `;
            
            processedDocs.forEach(doc => {
                displayHtml += `
                    <div style="border-left: 3px solid #0a84ff; padding-left: 8px; margin: 8px 0;">
                        <div style="font-weight: 500; font-size: 0.9em; color: #333;">${doc.title}</div>
                        <div style="font-size: 0.75em; color: #666;">${doc.contentLength} characters loaded</div>
                    </div>
                `;
            });
            
            displayHtml += `</div>`;
            
            return {
                json: {
                    success: true,
                    documentsLoaded: documents.length,
                    displayHtml: displayHtml,
                    documents: processedDocs,
                    aiContext: aiContext, // Full content for AI to process
                    message: `Content loaded successfully. AI can now answer detailed questions about: ${processedDocs.map(d => d.title).join(', ')}`,
                    timestamp: new Date().toISOString()
                }
            };
            
        } else {
            return {
                json: {
                    success: false,
                    documentsLoaded: 0,
                    error: 'No documents found',
                    displayHtml: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            <p style="color: #ff3b30; font-size: 0.9em;">⚠️ Could not load document content</p>
                        </div>
                    `,
                    timestamp: new Date().toISOString()
                }
            };
        }
        
    } catch (error) {
        return {
            json: {
                success: false,
                error: error.message || 'Failed to fetch document content',
                displayHtml: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <p style="color: #ff3b30; font-size: 0.9em;">⚠️ Error loading document content</p>
                    </div>
                `,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Execute and return
return fetchDocumentContent();