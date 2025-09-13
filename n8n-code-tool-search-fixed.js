// Search Tool for n8n Code Tools - Fixed Input Handling
// This version correctly reads input from Code Tools and returns preview links

// Code Tools pass input directly at the top level of $input
// Try multiple ways to get the query
let query = '';

// Method 1: Direct from $input (most common for Code Tools)
if ($input && typeof $input === 'object') {
    query = $input.query || $input.message || $input.text || '';
}

// Method 2: If $input is a string, use it directly
if (!query && typeof $input === 'string') {
    query = $input;
}

// Method 3: Try from items array (some n8n versions)
if (!query && $input && $input.all && $input.all().length > 0) {
    const firstItem = $input.all()[0];
    if (firstItem && firstItem.json) {
        query = firstItem.json.query || firstItem.json.message || '';
    }
}

// Set search type - change this for Quick vs Comprehensive
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search tool

console.log('Search query received:', query);
console.log('Input type:', typeof $input);
console.log('Input value:', JSON.stringify($input));

if (!query || query.trim() === '') {
    return JSON.stringify({
        success: false,
        error: 'No search query provided',
        documents: [],
        debug: {
            inputType: typeof $input,
            inputValue: $input
        }
    });
}

// Build the search URL with manual parameter construction
const baseUrl = 'https://saxtechmegamindfunctions.azurewebsites.net/api/SearchSOPs';
const searchUrl = `${baseUrl}?query=${encodeURIComponent(query)}&searchType=${searchType}`;

console.log('Search URL:', searchUrl);

try {
    // Perform the search using helpers.httpRequest
    const response = await helpers.httpRequest({
        method: 'GET',
        url: searchUrl,
        headers: {
            'Accept': 'application/json'
        }
    });

    // Parse response
    const searchResults = typeof response === 'string' ? JSON.parse(response) : response;
    
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
        const baseFileName = doc.fileName.replace(/_chunk_\d+$/, '');
        
        if (!groupedDocs[baseFileName]) {
            groupedDocs[baseFileName] = {
                fileName: baseFileName,
                title: doc.title || baseFileName,
                documentType: doc.documentType,
                department: doc.department,
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
        if (doc.searchScore > groupedDocs[baseFileName].searchScore) {
            groupedDocs[baseFileName].searchScore = doc.searchScore;
        }
    });

    // Process grouped documents
    const processedDocs = Object.values(groupedDocs).map(doc => {
        // Sort chunks by number
        doc.chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
        
        // Merge content (limit to first 1000 chars for preview)
        const fullContent = doc.chunks.map(c => c.content).join('\n\n');
        doc.content = fullContent.substring(0, 1000) + (fullContent.length > 1000 ? '...' : '');
        
        // Track which sections matched
        doc.matchedSections = doc.chunks.map(c => `Section ${c.chunkNumber + 1}`).join(', ');
        
        // IMPORTANT: Create the preview link that calls our JavaScript function
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;">📄 View ${doc.fileName}</a>`;
        
        // Create a summary for the AI
        doc.summary = `Document: ${doc.title} (${doc.documentType}) - Matched in ${doc.matchedSections}`;
        
        // HTML snippet for AI to include in response
        doc.htmlSnippet = `<div style="margin: 10px 0; padding: 12px; border-left: 3px solid #2196F3; background: #f9f9f9; border-radius: 4px;">
    <strong>📄 ${doc.title}</strong><br>
    <small style="color: #666;">Type: ${doc.documentType} | Department: ${doc.department}</small><br>
    <small style="color: #888;">Matched in: ${doc.matchedSections}</small><br>
    <div style="margin-top: 8px;">${doc.previewLink}</div>
</div>`;
        
        return doc;
    });

    // Sort by relevance
    processedDocs.sort((a, b) => b.searchScore - a.searchScore);

    // Return formatted response
    const result = {
        success: true,
        documents: processedDocs.slice(0, 10), // Limit to top 10
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} matching "${query}"`,
        instruction: "Display the htmlSnippet for each document to show preview links"
    };

    console.log(`Returning ${result.documents.length} documents`);
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