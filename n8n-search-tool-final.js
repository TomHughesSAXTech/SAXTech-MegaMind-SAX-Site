// Search Tool for n8n Code Tools - FINAL VERSION
// Correctly extracts query from the complex n8n input structure

// Debug the input structure
console.log('Raw $input:', JSON.stringify($input).substring(0, 500));

// Extract the query from the n8n Code Tool input structure
let query = '';

// The actual query is in $input.item.json.userMessage when coming from AI Agent
if ($input && $input.item && $input.item.json && $input.item.json.userMessage) {
    query = $input.item.json.userMessage;
    console.log('Found query in $input.item.json.userMessage:', query);
}

// Alternative: Check if it's in the query field
if (!query && $input && $input.item && $input.item.json && $input.item.json.query) {
    query = $input.item.json.query;
    console.log('Found query in $input.item.json.query:', query);
}

// Alternative: Direct $input.query (for manual testing)
if (!query && $input && $input.query) {
    query = $input.query;
    console.log('Found query in $input.query:', query);
}

// Alternative: If $input is a string
if (!query && typeof $input === 'string') {
    query = $input;
    console.log('$input is a string:', query);
}

// Set search type - CHANGE THIS LINE for Quick vs Comprehensive
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search tool

console.log('Final query extracted:', query);
console.log('Search type:', searchType);

if (!query || query.trim() === '') {
    return JSON.stringify({
        success: false,
        error: 'No search query provided',
        documents: [],
        debug: {
            message: 'Could not extract query from input',
            inputStructure: Object.keys($input || {}),
            hasItem: !!($input && $input.item),
            hasJson: !!($input && $input.item && $input.item.json),
            keys: $input && $input.item && $input.item.json ? Object.keys($input.item.json).slice(0, 10) : []
        }
    });
}

// Clean up the query - remove "give me the link to" type phrases
query = query.replace(/^(give me|show me|find|get|search for|look for|I need|where is|what is)(\s+the)?(\s+link)?(\s+to)?(\s+the)?\s*/i, '').trim();
console.log('Cleaned query:', query);

// Build the search URL
const baseUrl = 'https://saxtechmegamindfunctions.azurewebsites.net/api/SearchSOPs';
const searchUrl = `${baseUrl}?query=${encodeURIComponent(query)}&searchType=${searchType}`;

console.log('Search URL:', searchUrl);

try {
    // Perform the search
    const response = await helpers.httpRequest({
        method: 'GET',
        url: searchUrl,
        headers: {
            'Accept': 'application/json'
        }
    });

    // Parse response
    const searchResults = typeof response === 'string' ? JSON.parse(response) : response;
    console.log(`Search returned ${searchResults.documents ? searchResults.documents.length : 0} documents`);
    
    if (!searchResults.documents || searchResults.documents.length === 0) {
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
    
    searchResults.documents.forEach(doc => {
        // Remove chunk suffix to get base filename
        const baseFileName = doc.fileName.replace(/_chunk_\d+$/, '');
        
        if (!groupedDocs[baseFileName]) {
            groupedDocs[baseFileName] = {
                fileName: baseFileName,
                title: doc.title || baseFileName,
                documentType: doc.documentType || 'Document',
                department: doc.department || 'General',
                searchScore: doc.searchScore || doc['@search.score'] || 0,
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
            searchScore: doc.searchScore || doc['@search.score'] || 0
        });
        
        // Keep highest score
        if ((doc.searchScore || 0) > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc.searchScore;
        }
    });

    // Process grouped documents
    const processedDocs = Object.values(groupedDocs).map(doc => {
        // Sort chunks by number
        doc.chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
        
        // Merge content (limit for response size)
        const fullContent = doc.chunks.map(c => c.content).join('\n\n');
        doc.content = fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '');
        
        // Track which sections matched
        doc.matchedSections = doc.chunks.length > 1 ? 
            `Sections ${doc.chunks[0].chunkNumber + 1}-${doc.chunks[doc.chunks.length - 1].chunkNumber + 1}` :
            `Section ${doc.chunks[0].chunkNumber + 1}`;
        
        // CRITICAL: Create the preview link with onclick handler
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;" style="color: #2196F3; text-decoration: none; font-weight: bold;">📄 View ${doc.fileName}</a>`;
        
        // Create formatted result for AI to display
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

    // Build response
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
        searchType: searchType,
        debug: {
            errorDetails: error.toString(),
            url: searchUrl
        }
    });
}