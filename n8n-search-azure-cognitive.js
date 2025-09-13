// Search Tool for n8n Code Tools - Azure Cognitive Search Direct Query
// This queries your Azure Cognitive Search index directly and returns preview links

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
const searchEndpoint = 'https://saxtechmegamind.search.windows.net';
const indexName = 'sops-index'; // Your index name
const apiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO'; // Azure Search API key
const apiVersion = '2021-04-30-Preview';

// Set search type
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search

// Build the search URL
const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

try {
    // Build search request body with vector search
    const searchBody = {
        search: query,
        searchMode: searchType === 'comprehensive' ? 'all' : 'any',
        queryType: 'semantic', // Use semantic search for better results
        queryLanguage: 'en-US',
        semanticConfiguration: 'default', // Use your semantic configuration
        top: 50, // Get more results to group chunks
        select: 'fileName,title,content,documentType,department,tags,uploadDate,contentVector',
        includeTotalCount: true,
        // Vector search configuration
        vectors: [
            {
                value: await getQueryEmbedding(query), // Generate embedding for the query
                fields: 'contentVector', // Your vector field name
                k: 50, // Number of nearest neighbors
                exhaustive: searchType === 'comprehensive' // Exhaustive for comprehensive search
            }
        ],
        // Scoring profile if you have one configured
        scoringProfile: 'documentBoost', // Your scoring profile name
        // Facets for filtering if needed
        facets: ['documentType,count:10', 'department,count:10']
    };

    // Perform the search
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
            searchScore: doc['@search.score'] || 0
        });
        
        // Keep highest score
        if (doc['@search.score'] > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc['@search.score'];
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
        
        // CRITICAL: Create the preview link with onclick handler
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;" style="color: #2196F3; text-decoration: none; font-weight: bold;">📄 View ${doc.fileName}</a>`;
        
        // Create formatted HTML for display
        doc.displayHtml = `
<div style="margin: 15px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;">
    <h4 style="margin: 0 0 10px 0; color: #333;">📄 ${doc.title}</h4>
    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
        <strong>Type:</strong> ${doc.documentType} | 
        <strong>Department:</strong> ${doc.department} | 
        <strong>Matched:</strong> ${doc.matchedSections}
    </p>
    <p style="margin: 10px 0 5px 0;">${doc.previewLink}</p>
</div>`;
        
        return doc;
    });

    // Sort by relevance
    processedDocs.sort((a, b) => b.searchScore - a.searchScore);

    // Return formatted response
    const result = {
        success: true,
        documents: processedDocs.slice(0, 5), // Top 5 results
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} for "${query}"`,
        instruction: "Display each document's displayHtml field to show the preview links"
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
        searchType: searchType
    });
}