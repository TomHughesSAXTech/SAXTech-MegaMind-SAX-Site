// HYBRID SEMANTIC VECTOR SEARCH for n8n Code Tools
// Full implementation with OpenAI embeddings and Azure Cognitive Search

// Extract the query from n8n input
let query = '';

// Primary: AI Agent sends query in userMessage
if ($input && $input.item && $input.item.json && $input.item.json.userMessage) {
    query = $input.item.json.userMessage;
    console.log('Found query in userMessage:', query);
}

// Fallback: Direct query field
if (!query && $input && $input.query) {
    query = $input.query;
    console.log('Found query in $input.query:', query);
}

// Fallback: String input
if (!query && typeof $input === 'string') {
    query = $input;
    console.log('$input is string:', query);
}

if (!query || query.trim() === '') {
    return JSON.stringify({
        success: false,
        error: 'No search query provided',
        documents: []
    });
}

// Clean the query - remove common prefixes
query = query.replace(/^(give me|show me|find|get|search for|look for|I need|where is|what is)(\s+the)?(\s+link)?(\s+to)?(\s+the)?\s*/i, '').trim();
console.log('Cleaned query:', query);

// Azure Cognitive Search configuration
const searchEndpoint = 'https://saxmegamind-search.search.windows.net';
const indexName = 'sop-documents';
const apiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
const apiVersion = '2023-11-01';

// OpenAI configuration for embeddings
const openAIEndpoint = 'https://eastus2.api.cognitive.microsoft.com';
const openAIKey = '5f91bb46df2a4769be8715d063f8757c';
const embeddingDeployment = 'text-embedding-ada-002';

// IMPORTANT: Set search type here
// For Comprehensive Search Tool: use 'comprehensive'
// For Quick Search Tool: use 'quick'
const searchType = 'comprehensive'; // CHANGE THIS TO 'quick' FOR QUICK SEARCH TOOL

try {
    // Step 1: Generate embedding for the query
    console.log('Generating query embedding...');
    const embeddingUrl = `${openAIEndpoint}/openai/deployments/${embeddingDeployment}/embeddings?api-version=2023-05-15`;
    
    const embeddingResponse = await helpers.httpRequest({
        method: 'POST',
        url: embeddingUrl,
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

    // Step 2: Build hybrid search request with both text and vector
    const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    const searchBody = {
        search: query,
        searchMode: searchType === 'comprehensive' ? 'all' : 'any',
        queryType: 'simple',
        vectorQueries: [
            {
                kind: 'vector',
                vector: queryVector,
                fields: 'contentVector',
                k: 50,
                exhaustive: true
            }
        ],
        select: 'fileName,title,content,documentType,department,tags,createdDate,blobUrl',
        top: 50,
        count: true
    };

    console.log('Performing hybrid semantic vector search with mode:', searchBody.searchMode);

    // Step 3: Execute hybrid search
    const response = await helpers.httpRequest({
        method: 'POST',
        url: searchUrl,
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: searchBody
    });

    // Parse response
    const searchResults = typeof response === 'string' ? JSON.parse(response) : response;
    console.log(`Hybrid search found ${searchResults.value ? searchResults.value.length : 0} results`);

    if (!searchResults.value || searchResults.value.length === 0) {
        return JSON.stringify({
            success: true,
            documents: [],
            totalCount: 0,
            query: query,
            searchType: searchType,
            searchMethod: 'Hybrid Semantic Vector Search',
            message: `No documents found matching "${query}"`
        });
    }

    // Group chunks by base document name
    const groupedDocs = {};

    searchResults.value.forEach(doc => {
        // Remove _chunk_N suffix to get base filename
        const baseFileName = (doc.fileName || '').replace(/_chunk_\d+$/, '');
        
        if (!baseFileName) {
            console.log('Skipping doc with no fileName');
            return;
        }

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
                blobUrl: doc.blobUrl || ''
            };
        }

        // Extract chunk number
        const chunkMatch = doc.fileName ? doc.fileName.match(/_chunk_(\d+)$/) : null;
        const chunkNum = chunkMatch ? parseInt(chunkMatch[1]) : 0;

        groupedDocs[baseFileName].chunks.push({
            chunkNumber: chunkNum,
            content: doc.content || '',
            searchScore: doc['@search.score'] || 0,
            rerankerScore: doc['@search.rerankerScore'] || null
        });

        // Keep highest scores
        if ((doc['@search.score'] || 0) > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc['@search.score'] || 0;
        }
        if ((doc['@search.rerankerScore'] || 0) > (groupedDocs[baseFileName].rerankerScore || 0)) {
            groupedDocs[baseFileName].rerankerScore = doc['@search.rerankerScore'];
        }
    });

    // Process and format grouped documents
    const processedDocs = Object.values(groupedDocs).map(doc => {
        // Sort chunks by number
        doc.chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);

        // Combine content from chunks (limited for display)
        const fullContent = doc.chunks.map(c => c.content).join('\n\n');
        doc.content = fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '');

        // Create preview button - clean and simple, include department
        doc.previewButton = `<button onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;" style="
            padding: 8px 16px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        " onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">📄 Preview Document</button>`;

        // Use score for sorting but don't display it
        const scoreToUse = doc.rerankerScore !== null ? doc.rerankerScore : doc.searchScore;

        // Create HTML display card - clean without chunk info
        doc.displayHtml = `
<div style="margin: 15px 0; padding: 15px; border-left: 4px solid #2196F3; border-radius: 8px; background: #fafafa;">
    <h4 style="margin: 0 0 10px 0; color: #333;">📄 ${doc.title}</h4>
    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
        <strong>Type:</strong> ${doc.documentType} | 
        <strong>Department:</strong> ${doc.department}
    </p>
    <p style="margin: 10px 0 5px 0;">${doc.previewButton}</p>
</div>`;

        return doc;
    });

    // Sort by relevance score (uses reranker score if available)
    processedDocs.sort((a, b) => {
        const aScore = a.rerankerScore !== null ? a.rerankerScore : a.searchScore;
        const bScore = b.rerankerScore !== null ? b.rerankerScore : b.searchScore;
        return bScore - aScore;
    });

    // Return top 5 results
    const result = {
        success: true,
        documents: processedDocs.slice(0, 5),
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        searchMethod: 'Hybrid Semantic Vector Search',
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} for "${query}" using hybrid semantic vector search`,
        instruction: "Display each document's displayHtml field to show the preview links"
    };

    console.log(`Returning ${result.documents.length} documents from hybrid search`);
    return JSON.stringify(result);

} catch (error) {
    console.error('Hybrid search failed:', error);
    
    // Return error details
    return JSON.stringify({
        success: false,
        error: error.message || 'Hybrid semantic vector search failed',
        documents: [],
        query: query,
        searchType: searchType,
        searchMethod: 'Hybrid Semantic Vector Search',
        errorDetails: error.toString()
    });
}