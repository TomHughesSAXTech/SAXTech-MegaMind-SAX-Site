// FINAL WORKING Azure Cognitive Search for n8n Code Tools
// Direct search - no Azure Functions needed

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

// IMPORTANT: Set search type here
// For Comprehensive Search Tool: use 'comprehensive'
// For Quick Search Tool: use 'quick'
const searchType = 'comprehensive'; // CHANGE THIS TO 'quick' FOR QUICK SEARCH TOOL

// Build search URL
const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

try {
    // Build search request body
    const searchBody = {
        search: query,
        searchMode: searchType === 'comprehensive' ? 'all' : 'any',
        queryType: 'simple',
        select: 'fileName,title,content,documentType,department,tags,createdDate,blobUrl',
        top: 50,
        count: true
    };

    console.log('Performing search with mode:', searchBody.searchMode);

    // Execute search
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
    console.log(`Search found ${searchResults.value ? searchResults.value.length : 0} results`);

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
            searchScore: doc['@search.score'] || 0
        });

        // Keep highest score
        if ((doc['@search.score'] || 0) > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc['@search.score'] || 0;
        }
    });

    // Process and format grouped documents
    const processedDocs = Object.values(groupedDocs).map(doc => {
        // Sort chunks by number
        doc.chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);

        // Combine content from chunks (limited for display)
        const fullContent = doc.chunks.map(c => c.content).join('\n\n');
        doc.content = fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '');

        // Track matched sections
        const matchedSections = doc.chunks.length > 1 ? 
            `Sections ${doc.chunks[0].chunkNumber + 1}-${doc.chunks[doc.chunks.length - 1].chunkNumber + 1}` :
            `Section ${doc.chunks[0].chunkNumber + 1}`;

        // Create preview link - CRITICAL for document preview modal
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}'); return false;" style="color: #2196F3; text-decoration: none; font-weight: bold;">📄 View ${doc.fileName}</a>`;

        // Keep score for sorting but don't display it

        // Create HTML display card
        doc.displayHtml = `
<div style="margin: 15px 0; padding: 15px; border-left: 4px solid #2196F3; border-radius: 8px; background: #fafafa;">
    <h4 style="margin: 0 0 10px 0; color: #333;">📄 ${doc.title}</h4>
    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
        <strong>Type:</strong> ${doc.documentType} | 
        <strong>Department:</strong> ${doc.department} | 
        <strong>Matched:</strong> ${matchedSections}
    </p>
    <p style="margin: 10px 0 5px 0;">${doc.previewLink}</p>
</div>`;

        return doc;
    });

    // Sort by relevance score
    processedDocs.sort((a, b) => b.searchScore - a.searchScore);

    // Return top 5 results
    const result = {
        success: true,
        documents: processedDocs.slice(0, 5),
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} for "${query}"`,
        instruction: "Display each document's displayHtml field to show the preview links"
    };

    console.log(`Returning ${result.documents.length} documents`);
    return JSON.stringify(result);

} catch (error) {
    console.error('Search failed:', error);
    
    // Return error details for debugging
    return JSON.stringify({
        success: false,
        error: error.message || 'Search failed',
        documents: [],
        query: query,
        searchType: searchType,
        errorDetails: error.toString(),
        searchUrl: searchUrl
    });
}