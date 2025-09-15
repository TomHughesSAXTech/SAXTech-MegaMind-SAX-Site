// FORMAT DOCUMENT RESULTS FIX
// Formats the Azure Document Intelligence analysis results

const input = $json;
const allInputs = $input.all();

console.log('[Format Document Results] Processing analysis results');

// Get the analysis results
const analyzeResult = input.analyzeResult || input;

// Extract metadata
const metadata = {
    status: input.status || 'succeeded',
    createdDateTime: input.createdDateTime || new Date().toISOString(),
    lastUpdatedDateTime: input.lastUpdatedDateTime || new Date().toISOString(),
    apiVersion: analyzeResult.apiVersion || '2023-07-31',
    modelId: analyzeResult.modelId || 'prebuilt-read'
};

// Extract the text content
let extractedText = '';
const pages = analyzeResult.pages || [];
const paragraphs = analyzeResult.paragraphs || [];
const content = analyzeResult.content || '';

// Method 1: Use content if available (simplest)
if (content) {
    extractedText = content;
    console.log('[Format Document Results] Using content field:', content.length, 'characters');
}

// Method 2: Extract from paragraphs if no content
if (!extractedText && paragraphs.length > 0) {
    extractedText = paragraphs.map(p => p.content || '').join('\n\n');
    console.log('[Format Document Results] Extracted from paragraphs:', paragraphs.length, 'paragraphs');
}

// Method 3: Extract from pages if still no content
if (!extractedText && pages.length > 0) {
    for (const page of pages) {
        if (page.lines) {
            const pageText = page.lines.map(line => line.content || '').join('\n');
            extractedText += pageText + '\n\n';
        }
    }
    console.log('[Format Document Results] Extracted from pages:', pages.length, 'pages');
}

// Get document metadata from original upload if available
let fileName = 'document';
let fileType = 'pdf';

// Try to find filename from previous nodes
for (const item of allInputs) {
    if (item.json?.fileName) {
        fileName = item.json.fileName;
    }
    if (item.json?.fileType) {
        fileType = item.json.fileType;
    }
}

// Format the final output
const output = {
    success: true,
    fileName: fileName,
    fileType: fileType,
    extractedText: extractedText.trim(),
    textLength: extractedText.length,
    pageCount: pages.length,
    paragraphCount: paragraphs.length,
    metadata: metadata,
    summary: {
        hasText: !!extractedText,
        pages: pages.length,
        paragraphs: paragraphs.length,
        characters: extractedText.length,
        words: extractedText.split(/\s+/).filter(w => w.length > 0).length
    },
    timestamp: new Date().toISOString()
};

console.log('[Format Document Results] Output summary:', output.summary);

return [output];