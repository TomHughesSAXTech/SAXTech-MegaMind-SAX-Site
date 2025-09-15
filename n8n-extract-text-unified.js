// UNIFIED EXTRACT TEXT - Handles both Computer Vision (screenshots) and Document Intelligence (PDFs/docs)
const input = $json;
const allInputs = $input.all();

console.log('[Extract Text] Processing input type detection');
console.log('[Extract Text] Input keys:', Object.keys(input).slice(0, 10));

let extractedText = '';
let visionDescription = '';
let documentType = 'unknown';

// CASE 1: Document Intelligence output (PDFs, Word docs, etc.)
// These have extractedText, fileName, fileType from Format Document Results
if (input.extractedText && typeof input.extractedText === 'string') {
    console.log('[Extract Text] Found Document Intelligence output');
    extractedText = input.extractedText;
    documentType = 'document';
    
    // Add metadata if available
    if (input.fileName) {
        visionDescription = `Document: ${input.fileName}`;
    }
    if (input.summary) {
        visionDescription += ` (${input.summary.pages} pages, ${input.summary.words} words)`;
    }
}

// CASE 2: Computer Vision output (screenshots, images)
// These have readResult.blocks structure
else if (input.readResult && input.readResult.blocks) {
    console.log('[Extract Text] Found Computer Vision output');
    documentType = 'image';
    
    const allExtractedLines = [];
    for (const block of input.readResult.blocks) {
        if (block.lines) {
            for (const line of block.lines) {
                if (line.text) {
                    allExtractedLines.push(line.text);
                }
            }
        }
    }
    
    extractedText = allExtractedLines.join(' ');
    console.log('[Extract Text] Extracted OCR text:', extractedText);
    
    // Get image description
    if (input.captionResult && input.captionResult.text) {
        visionDescription = input.captionResult.text;
    }
}

// CASE 3: Already processed text (from previous nodes)
else if (input.text || input.content || input.message) {
    console.log('[Extract Text] Found pre-processed text');
    extractedText = input.text || input.content || input.message;
    documentType = 'text';
}

// CASE 4: Search through all inputs for any text content
if (!extractedText) {
    console.log('[Extract Text] Searching all inputs for text content');
    for (const item of allInputs) {
        const data = item.json || item;
        
        // Check for document text
        if (data.extractedText) {
            extractedText = data.extractedText;
            documentType = 'document';
            break;
        }
        
        // Check for OCR text
        if (data.ocrText) {
            extractedText = data.ocrText;
            documentType = 'ocr';
            break;
        }
        
        // Check for content field
        if (data.content) {
            extractedText = data.content;
            documentType = 'content';
            break;
        }
    }
}

// Build comprehensive output
let fullContext = extractedText;

// Add description for context if available
if (visionDescription && visionDescription !== extractedText) {
    fullContext = `${visionDescription}\n\nContent: ${extractedText}`;
}

// Get tags if available (for images)
let tags = [];
if (input.tagsResult && input.tagsResult.values) {
    tags = input.tagsResult.values
        .filter(tag => tag.confidence > 0.8)
        .map(tag => tag.name);
}

console.log('[Extract Text] Final extraction:', {
    documentType: documentType,
    hasText: !!extractedText,
    textLength: extractedText.length,
    preview: extractedText.substring(0, 100)
});

// Return comprehensive output
return [{
    json: {
        // Main extracted text
        extractedText: extractedText,
        
        // For compatibility with different node expectations
        text: extractedText,
        content: extractedText,
        message: extractedText,
        
        // Analysis and context
        visionAnalysis: fullContext,
        ocrText: documentType === 'image' ? extractedText : '',
        documentText: documentType === 'document' ? extractedText : '',
        
        // Metadata
        imageDescription: visionDescription,
        documentType: documentType,
        tags: tags,
        
        // Status
        hasText: !!extractedText,
        textLength: extractedText.length,
        
        // Full context for AI
        fullContext: fullContext,
        
        // Debug info
        timestamp: new Date().toISOString(),
        debug: {
            documentType: documentType,
            inputKeys: Object.keys(input).slice(0, 10),
            hasExtractedText: !!extractedText,
            extractedFrom: documentType
        }
    }
}];