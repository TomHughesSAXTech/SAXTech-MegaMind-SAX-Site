// Direct Azure Cognitive Search Integration for n8n
// This version calls Azure Cognitive Search directly with proper API syntax

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
const searchEndpoint = 'https://saxmegamind-search.search.windows.net';
const indexName = 'sop-documents';
const apiKey = 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO';
const apiVersion = '2023-11-01';

// OpenAI configuration for generating query embeddings
const openAIEndpoint = 'https://eastus2.api.cognitive.microsoft.com';
const openAIKey = '5f91bb46df2a4769be8715d063f8757c';
const embeddingDeployment = 'text-embedding-ada-002';

// Set search type
const searchType = 'comprehensive'; // Change to 'quick' for Quick Search

// Build the search URL
const searchUrl = `${searchEndpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

try {
    // Step 1: Try to generate embedding for the query
    let queryVector = null;
    let vectorSearchEnabled = false;
    
    try {
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
        queryVector = embeddingData.data[0].embedding;
        vectorSearchEnabled = true;
        
        console.log('Query embedding generated, vector length:', queryVector.length);
        
    } catch (embeddingError) {
        console.log('Could not generate embedding, will use text-only search:', embeddingError.message);
    }

    // Step 2: Build search request
    let searchBody;
    let searchMethod;
    
    if (vectorSearchEnabled && queryVector) {
        // Hybrid search with correct 2023-11-01 API syntax
        searchBody = {
            search: query,
            searchMode: searchType === 'comprehensive' ? 'all' : 'any',
            queryType: 'simple',
            vectorQueries: [
                {
                    kind: 'vector',
                    vector: queryVector,
                    fields: 'contentVector',
                    k: 50
                }
            ],
            select: 'fileName,title,content,documentType,department,tags,uploadDate',
            top: 50,
            count: true
        };
        searchMethod = 'Hybrid (Text + Vector)';
    } else {
        // Text-only search
        searchBody = {
            search: query,
            searchMode: searchType === 'comprehensive' ? 'all' : 'any',
            queryType: 'simple',
            select: 'fileName,title,content,documentType,department,tags,uploadDate',
            top: 50,
            count: true
        };
        searchMethod = 'Text search only';
    }

    console.log('Search method:', searchMethod);

    // Step 3: Perform the search
    let response;

    try {
        console.log('Performing search...');

        response = await helpers.httpRequest({
            method: 'POST',
            url: searchUrl,
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: searchBody
        });

    } catch (searchError) {
        // If hybrid search failed, try text-only
        if (vectorSearchEnabled && searchBody.vectorQueries) {
            console.log('Hybrid search failed, trying text-only:', searchError.message);

            delete searchBody.vectorQueries;
            searchMethod = 'Text search (fallback)';

            response = await helpers.httpRequest({
                method: 'POST',
                url: searchUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: searchBody
            });
        } else {
            throw searchError;
        }
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
            searchMethod: searchMethod,
            message: `No documents found matching "${query}"`
        });
    }

    // Group chunks by document
    const groupedDocs = {};

    searchResults.value.forEach(doc => {
        // Remove chunk suffix to get base filename
        const baseFileName = (doc.fileName || '').replace(/_chunk_\d+$/, '');

        if (!baseFileName) {
            console.log('Skipping document with no fileName');
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
                matchedSections: []
            };
        }

        // Add chunk info
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

        // Calculate simple relevance percentage
        const relevancePercent = Math.min(100, Math.round((doc.searchScore || 0) * 100));
        const relevanceColor = relevancePercent > 70 ? '#4CAF50' : relevancePercent > 40 ? '#FF9800' : '#9E9E9E';

        // Create formatted HTML for display
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
        searchMethod: searchMethod,
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
        details: error.toString()
    });
}