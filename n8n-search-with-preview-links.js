// Search Tool for n8n Code Tools with proper preview link format
// This version returns clickable preview links that use openDocumentPreview()

// Get the query parameter from Code Tool input
// In Code Tools, input comes through $input, not $json
const query = $input.query || $input.message || '';
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search tool

console.log('Search query received:', query);

if (!query || query.trim() === '') {
    return JSON.stringify({
        success: false,
        error: 'No search query provided',
        documents: []
    });
}

// Build the search URL
const baseUrl = 'https://saxtechmegamindfunctions.azurewebsites.net/api/SearchSOPs';
const params = new URLSearchParams();
params.append('query', query);
params.append('searchType', searchType);

const searchUrl = `${baseUrl}?${params.toString()}`;

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
        
        // Merge content
        doc.content = doc.chunks.map(c => c.content).join('\n\n');
        
        // Track which sections matched
        doc.matchedSections = doc.chunks.map(c => `Section ${c.chunkNumber + 1}`);
        
        // IMPORTANT: Create the preview link format
        // This is what will make the preview work in the chat
        doc.previewLink = `<a href="#" onclick="openDocumentPreview('${doc.fileName}', '${doc.department}'); return false;">📄 View ${doc.fileName}</a>`;
        
        // Also include a formatted HTML snippet for the AI to use
        doc.htmlSnippet = `
            <div style="margin: 10px 0; padding: 10px; border-left: 3px solid #2196F3; background: #f5f5f5;">
                <strong>${doc.title}</strong><br>
                <small>Type: ${doc.documentType} | Dept: ${doc.department}</small><br>
                ${doc.previewLink}
            </div>
        `;
        
        return doc;
    });

    // Sort by relevance
    processedDocs.sort((a, b) => b.searchScore - a.searchScore);

    // Return as JSON string for Code Tool
    return JSON.stringify({
        success: true,
        documents: processedDocs.slice(0, 10), // Limit to top 10
        totalCount: processedDocs.length,
        query: query,
        searchType: searchType,
        message: `Found ${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} matching "${query}"`
    });

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