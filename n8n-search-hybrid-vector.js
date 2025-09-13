// Hybrid Semantic Vector Search for n8n Code Tools
// Uses text + vector search with embeddings, scoring profiles, and chunking

// Extract the query from the input
let query = '';

// The query comes from the AI Agent in $input.item.json.userMessage
if ($input && $input.item && $input.item.json && $input.item.json.userMessage) {
    query = $input.item.json.userMessage;
}

// Fallback methods
if (!query && $input && $input.query) {
    query = $input.query;
}
if (!query && typeof $input === 'string') {
    query = $input;
}

console.log('Search query:', query);

if (!query || query.trim() === '') {
    return JSON.stringify({
        success: false,
        error: 'No search query provided',
        documents: []
    });
}

// Clean up the query
query = query.replace(/^(give me|show me|find|get|search for|look for|I need|where is|what is)(\s+the)?(\s+link)?(\s+to)?(\s+the)?\s*/i, '').trim();

// Azure Cognitive Search configuration
const searchEndpoint = 'https://saxmegamind-search.search.windows.net'; // Correct endpoint
const indexName = 'sop-documents'; // Correct index name from your Azure Function
const apiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
const apiVersion = '2023-11-01'; // Latest stable version for vector search

// OpenAI configuration for generating query embeddings
const openAIEndpoint = 'https://eastus2.api.cognitive.microsoft.com';
const openAIKey = '5f91bb46df2a4769be8715d063f8757c';
const embeddingDeployment = 'text-embedding-ada-002';

// Set search type
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search

try {
    // Step 1: Generate embedding for the query
    console.log('Generating query embedding...');
    
    const embeddingResponse = await helpers.httpRequest({
        method: 'POST',
        url: `${openAIEndpoint}/openai/deployments/${embeddingDeployment}/embeddings?api-version=2023-05-15`,
        headers: {
            'Content-Type': 'application/json',
            'api-key': openAIKey
        },
        body: {
            input: query
        }
    });
    
    const embeddingData = typeof embeddingResponse === 'string' ? JSON.parse(embeddingResponse) : embeddingResponse;
    const queryVector = embeddingData.data[0].embedding;
    
    console.log('Query embedding generated, vector length:', queryVector.length);

    // Step 2: Try vector search first, then fallback to text-only if it fails
    const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    // Build hybrid search request with correct syntax
    const searchBody = {
        // Text search component
        search: query,
        searchMode: searchType === 'comprehensive' ? 'all' : 'any',
        queryType: 'simple', // Start with simple, semantic might need configuration
        
        // Vector search component - correct format for Azure Cognitive Search
        vectors: [
            {
                value: queryVector,
                fields: 'contentVector', // Your vector field name
                k: 50 // Number of nearest neighbors
            }
        ],
        
        // Fields to return
        select: 'fileName,title,content,documentType,department,tags,uploadDate',
        
        // Number of results
        top: 50,
        
        // Include total count
        count: true
    };
    
    // Add scoring profile if it exists
    // searchBody.scoringProfile = 'documentBoost';

    console.log('Attempting hybrid search with vectors...');
    
    let response;
    let searchMethod = 'Hybrid (Text + Vector)';
    
    try {
        // Try with vector search first
        response = await helpers.httpRequest({
            method: 'POST',
            url: searchUrl,
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: searchBody
        });
    } catch (vectorError) {
        console.log('Vector search failed, falling back to text-only search:', vectorError.message);
        
        // Fallback to text-only search
        delete searchBody.vectors;
        searchMethod = 'Text search';
        
        response = await helpers.httpRequest({
            method: 'POST',
            url: searchUrl,
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: searchBody
        });
    }

    // Parse response
    const searchResults = typeof response === 'string' ? JSON.parse(response) : response;
    
    console.log(`Search returned ${searchResults.value ? searchResults.value.length : 0} results`);
    
    if (!searchResults.value || searchResults.value.length === 0) {
        return JSON.stringify({
            success: true,
            documents: [],
            totalCount: 0,
            query: query,
            searchType: searchType,
            message: `No documents found matching "${query}"`
        });
    }

    // Group chunks by document
    const groupedDocs = {};
    
    searchResults.value.forEach(doc => {
        // Remove chunk suffix to get base filename
        const baseFileName = doc.fileName.replace(/_chunk_\d+$/, '');
        
        if (!groupedDocs[baseFileName]) {
            groupedDocs[baseFileName] = {
                fileName: baseFileName,
                title: doc.title || baseFileName,
                documentType: doc.documentType || 'Document',
                department: doc.department || 'General',
                searchScore: doc['@search.score'] || 0,
                rerankerScore: doc['@search.rerankerScore'] || null,
                chunks: [],
                content: '',
                matchedSections: []
            };
        }
        
        // Add chunk info
        const chunkMatch = doc.fileName.match(/_chunk_(\d+)$/);
        const chunkNum = chunkMatch ? parseInt(chunkMatch[1]) : 0;
        
        groupedDocs[baseFileName].chunks.push({
            chunkNumber: chunkNum,
            content: doc.content || '',
            searchScore: doc['@search.score'] || 0,
            rerankerScore: doc['@search.rerankerScore'] || null
        });
        
        // Keep highest scores
        if (doc['@search.score'] > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc['@search.score'];
        }
        if (doc['@search.rerankerScore'] && (!groupedDocs[baseFileName].rerankerScore || doc['@search.rerankerScore'] > groupedDocs[baseFileName].rerankerScore)) {
            groupedDocs[baseFileName].rerankerScore = doc['@search.rerankerScore'];
        }
    });

    // Process grouped documents
    const processedDocs = Object.values(groupedDocs).map(doc => {
        // Sort chunks by number
        doc.chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
        
        // Merge content (limit for display)
        const fullContent = doc.chunks.map(c => c.content).join('\n\n');
        doc.content = fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '');
        
        // Track which sections matched
        if (doc.chunks.length > 1) {
            doc.matchedSections = `Sections ${doc.chunks[0].chunkNumber + 1}-${doc.chunks[doc.chunks.length - 1].chunkNumber + 1}`;
        } else {
            doc.matchedSections = `Section ${doc.chunks[0].chunkNumber + 1}`;
        }
        
        // Calculate relevance percentage (0-100)
        const relevanceScore = doc.rerankerScore || doc.searchScore;
        const relevancePercent = Math.min(100, Math.round(relevanceScore * 25)); // Adjust scale as needed
        
        // CRITICAL: Create the preview link with onclick handler
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;" style="color: #2196F3; text-decoration: none; font-weight: bold;">📄 View ${doc.fileName}</a>`;
        
        // Create formatted HTML for display with relevance indicator
        const relevanceColor = relevancePercent > 75 ? '#4CAF50' : relevancePercent > 50 ? '#FF9800' : '#9E9E9E';
        
        doc.displayHtml = `
<div style="margin: 15px 0; padding: 15px; border-left: 4px solid ${relevanceColor}; border-radius: 8px; background: #fafafa;">
    <h4 style="margin: 0 0 10px 0; color: #333;">📄 ${doc.title}</h4>
    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
        <strong>Type:</strong> ${doc.documentType} | 
        <strong>Department:</strong> ${doc.department} | 
        <strong>Matched:</strong> ${doc.matchedSections}
    </p>
    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
        <strong>Relevance:</strong> <span style="color: ${relevanceColor}; font-weight: bold;">${relevancePercent}%</span>
        ${doc.rerankerScore ? ' (Semantic match)' : ' (Keyword match)'}
    </p>
    <p style="margin: 10px 0 5px 0;">${doc.previewLink}</p>
</div>`;
        
        return doc;
    });

    // Sort by relevance (use reranker score if available, otherwise search score)
    processedDocs.sort((a, b) => {
        const scoreA = a.rerankerScore || a.searchScore;
        const scoreB = b.rerankerScore || b.searchScore;
        return scoreB - scoreA;
    });

    // Return formatted response
    const result = {
        success: true,
        documents: processedDocs.slice(0, 5), // Top 5 results
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        searchMethod: searchMethod,
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} for "${query}"`,
        instruction: "Display each document's displayHtml field to show the preview links",
        facets: searchResults['@search.facets'] || {}
    };

    console.log(`Returning ${result.documents.length} documents with preview links`);
    return JSON.stringify(result);

} catch (error) {
    console.error('Search error:', error);
    return JSON.stringify({
        success: false,
        error: error.message || 'Search failed',
        documents: [],
        query: query,
        searchType: searchType,
        debug: {
            errorDetails: error.toString()
        }
    });
}