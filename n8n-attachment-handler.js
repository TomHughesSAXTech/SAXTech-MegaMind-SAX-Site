// Comprehensive Attachment Handler for Images and Documents
const inputData = $input.all()[0].json;
const attachments = inputData.body?.attachments || inputData.attachments || [];

// Azure Computer Vision Configuration for OCR
const VISION_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const VISION_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';
const OCR_API_PATH = 'vision/v3.2/ocr';

// Document Intelligence Configuration (if you have it)
const DOCUMENT_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const DOCUMENT_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';

let extractedContent = '';
let processedAttachments = [];

// Debug logging
console.log('Total attachments found:', attachments.length);
attachments.forEach((att, index) => {
    console.log(`Attachment ${index + 1}:`, {
        name: att.name,
        type: att.type,
        size: att.size,
        isScreenshot: att.isScreenshot,
        hasData: !!att.data
    });
});

// Process each attachment based on type
for (const attachment of attachments) {
    if (!attachment.data) continue;
    
    try {
        const fileName = attachment.name || 'unnamed';
        const fileType = attachment.type || '';
        
        console.log(`Processing attachment: ${fileName} (${fileType})`);
        
        // Handle images and screenshots
        if (attachment.isScreenshot || fileType.startsWith('image/')) {
            console.log('Processing as image/screenshot...');
            
            // Extract base64 data
            const base64Data = attachment.data.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            try {
                // Call Azure Computer Vision OCR API
                const ocrResponse = await this.helpers.httpRequest({
                    method: 'POST',
                    url: `${VISION_ENDPOINT}${OCR_API_PATH}`,
                    headers: {
                        'Ocp-Apim-Subscription-Key': VISION_KEY,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: imageBuffer,
                    qs: {
                        language: 'en',
                        detectOrientation: 'true'
                    },
                    json: false,
                    returnFullResponse: false
                });
                
                // Extract text from OCR response
                let imageText = '';
                if (ocrResponse.regions && ocrResponse.regions.length > 0) {
                    ocrResponse.regions.forEach(region => {
                        if (region.lines) {
                            region.lines.forEach(line => {
                                let lineText = '';
                                if (line.words) {
                                    line.words.forEach(word => {
                                        lineText += word.text + ' ';
                                    });
                                }
                                imageText += lineText.trim() + '\n';
                            });
                        }
                    });
                }
                
                if (imageText) {
                    extractedContent += `\n\n--- Image Content from ${fileName} ---\n${imageText.trim()}\n`;
                    processedAttachments.push({
                        name: fileName,
                        type: 'image',
                        text: imageText.trim()
                    });
                }
            } catch (ocrError) {
                console.error(`OCR failed for ${fileName}:`, ocrError.message);
            }
        }
        // Handle PDF documents
        else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            console.log('Processing as PDF document...');
            
            // For now, we'll note that a PDF was attached
            // You could integrate Azure Form Recognizer or another PDF processing service here
            extractedContent += `\n\n--- Document Attached: ${fileName} ---\n`;
            extractedContent += `[PDF Document - ${attachment.size} bytes]\n`;
            extractedContent += `Note: PDF content extraction requires additional processing.\n`;
            
            processedAttachments.push({
                name: fileName,
                type: 'pdf',
                size: attachment.size,
                note: 'PDF processing not yet implemented'
            });
        }
        // Handle Word documents
        else if (fileType.includes('word') || fileName.match(/\.(doc|docx)$/i)) {
            console.log('Processing as Word document...');
            
            extractedContent += `\n\n--- Document Attached: ${fileName} ---\n`;
            extractedContent += `[Word Document - ${attachment.size} bytes]\n`;
            extractedContent += `Note: Word document content extraction requires additional processing.\n`;
            
            processedAttachments.push({
                name: fileName,
                type: 'word',
                size: attachment.size,
                note: 'Word processing not yet implemented'
            });
        }
        // Handle text files
        else if (fileType.startsWith('text/') || fileName.match(/\.(txt|md|csv|log)$/i)) {
            console.log('Processing as text file...');
            
            // Try to decode text content from base64
            try {
                const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, '');
                const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
                
                extractedContent += `\n\n--- Text Content from ${fileName} ---\n${textContent}\n`;
                
                processedAttachments.push({
                    name: fileName,
                    type: 'text',
                    text: textContent
                });
            } catch (textError) {
                console.error(`Text extraction failed for ${fileName}:`, textError.message);
            }
        }
        // Handle other file types
        else {
            console.log(`Unknown file type: ${fileType}`);
            
            extractedContent += `\n\n--- Attachment: ${fileName} ---\n`;
            extractedContent += `[File Type: ${fileType || 'Unknown'} - ${attachment.size} bytes]\n`;
            
            processedAttachments.push({
                name: fileName,
                type: fileType || 'unknown',
                size: attachment.size
            });
        }
        
    } catch (error) {
        console.error(`Error processing attachment:`, error.message);
    }
}

// Get the original message
const originalMessage = inputData.body?.message || inputData.message || '';

// Create enhanced message
let enhancedMessage = originalMessage;

// Remove any existing attachment context placeholders
enhancedMessage = enhancedMessage.replace(/\[Context: User has .*?\]/g, '').trim();

// Add extracted content if any attachments were processed
if (extractedContent) {
    enhancedMessage = `${enhancedMessage}

[Attached Content]:${extractedContent}

Please acknowledge and analyze the attached content above when responding.`;
} else if (attachments.length > 0) {
    // Attachments exist but couldn't be processed
    const attachmentList = attachments.map(a => `- ${a.name} (${a.type || 'unknown type'})`).join('\n');
    enhancedMessage = `${enhancedMessage}

[User has attached ${attachments.length} file(s)]:
${attachmentList}

Note: The attached files are present but content extraction is pending.`;
}

console.log(`Message enhanced. Processed ${processedAttachments.length} attachments.`);

// Return enhanced data
const outputData = {
    ...inputData.body || inputData,
    message: enhancedMessage,
    originalMessage: originalMessage,
    attachmentCount: attachments.length,
    processedAttachments: processedAttachments,
    extractedContent: extractedContent,
    hasAttachments: attachments.length > 0,
    attachments: attachments // Keep original attachments
};

return [{
    json: outputData
}];