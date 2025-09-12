// Override the queryIndex function to add comprehensive logging
window.queryIndex = async function() {
    console.log('=== QUERY INDEX DEBUG START ===');
    const query = document.getElementById('searchQuery').value || '*';
    const filter = document.getElementById('searchFilter').value;
    const top = document.getElementById('maxResults').value;
    
    console.log('Query parameters:', { query, filter, top });
    
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('loading').classList.add('show');
    document.getElementById('results').innerHTML = '';
    
    try {
        const requestBody = {
            query: query,
            search: query,
            filter: filter,
            top: parseInt(top),
            select: 'id,title,fileName,department,documentType,uploadDate,createdDate,author,fileSize,status,vectorized,chunkCount,conversionMethod,contentHash,contentLength,metadata'
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        console.log('API URL:', `${API_CONFIG.functionUrl}/documents/search`);
        
        const response = await fetch(
            `${API_CONFIG.functionUrl}/documents/search`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': API_CONFIG.functionKey
                },
                body: JSON.stringify(requestBody)
            }
        );
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.ok) {
            const data = await response.json();
            console.log('=== RAW API RESPONSE ===');
            console.log('Full response data:', data);
            
            const documents = data.results || data.value || [];
            console.log(`Number of documents: ${documents.length}`);
            
            // Log each document's structure
            documents.forEach((doc, index) => {
                console.log(`\n=== DOCUMENT ${index + 1} ===`);
                console.log('ID:', doc.id);
                console.log('Title:', doc.title);
                console.log('FileName:', doc.fileName);
                console.log('Status:', doc.status);
                console.log('Vectorized:', doc.vectorized, '(type:', typeof doc.vectorized, ')');
                console.log('ChunkCount:', doc.chunkCount, '(type:', typeof doc.chunkCount, ')');
                console.log('ContentLength:', doc.contentLength, '(type:', typeof doc.contentLength, ')');
                console.log('ConversionMethod:', doc.conversionMethod);
                console.log('Department:', doc.department);
                console.log('DocumentType:', doc.documentType);
                console.log('FileSize:', doc.fileSize);
                console.log('Metadata:', doc.metadata);
                console.log('All fields:', Object.keys(doc));
                console.log('Full document:', doc);
            });
            
            displayResults(documents);
            showAlert('success', `Found ${documents.length} documents`);
        } else {
            console.error('Response not OK:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response body:', errorText);
            throw new Error('Search failed');
        }
    } catch (error) {
        console.error('=== QUERY ERROR ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        showAlert('error', 'Search error: ' + error.message);
    } finally {
        document.getElementById('loading').classList.remove('show');
        console.log('=== QUERY INDEX DEBUG END ===');
    }
};

console.log('Debug script loaded! Click "Query Index" to see detailed logging.');