// Check the content field length for the first document
async function checkContentLength() {
    const response = await fetch(
        `${API_CONFIG.functionUrl}/documents/search`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': API_CONFIG.functionKey
            },
            body: JSON.stringify({
                query: '*',
                top: 1,
                select: 'id,title,content,extractedText,ocrText'
            })
        }
    );
    
    const data = await response.json();
    const doc = (data.results || data.value || [])[0];
    
    if (doc) {
        console.log('=== CONTENT LENGTH CHECK ===');
        console.log('Document ID:', doc.id);
        console.log('Title:', doc.title);
        console.log('Content length:', doc.content ? doc.content.length : 0, 'characters');
        console.log('ExtractedText length:', doc.extractedText ? doc.extractedText.length : 0, 'characters');
        console.log('OcrText length:', doc.ocrText ? doc.ocrText.length : 0, 'characters');
        console.log('Content preview (first 200 chars):', doc.content ? doc.content.substring(0, 200) : 'No content');
    }
}

checkContentLength();