// OCR Processing for Screenshots and Document Attachments - Using n8n Helpers
// Azure Document Intelligence Integration for n8n

// Configuration
const AZURE_ENDPOINT = 'https://sax-megamind-document-intel.cognitiveservices.azure.com/';
const AZURE_API_KEY = '0f91c7f056284e1c84695c0af94797c1';
const API_VERSION = '2024-02-29-preview';

// Get the webhook data
const webhookData = $input.first().json;
const data = webhookData.body || webhookData;

// Initialize result
let result = {
    sessionId: data.sessionId || '',
    userMessage: data.message || data.userMessage || '',
    chatInput: data.message || data.userMessage || '',
    extractedContent: '',
    processedAttachments: 0,
    hasAttachments: false,
    attachmentCount: 0,
    body: {}
};

// Check for attachments
const attachments = data.attachments || [];
result.hasAttachments = attachments.length > 0;
result.attachmentCount = attachments.length;

if (!attachments || attachments.length === 0) {
    console.log('No attachments found');
    // Preserve all original data in body
    result.body = data;
    return result;
}

console.log(`Processing ${attachments.length} attachments`);

// Helper function to decode base64 in n8n environment
function decodeBase64(base64String) {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:.*?;base64,/, '');
    // Use Buffer to decode base64 (available in n8n)
    return Buffer.from(base64Data, 'base64');
}

// Helper function to extract text from image using Azure Document Intelligence
async function extractTextFromImage(attachment, helpers) {
    try {
        console.log(`Processing attachment: ${attachment.name}`);
        
        // Decode base64 image data
        const imageBuffer = decodeBase64(attachment.data);
        
        // Start analysis
        const analyzeUrl = `${AZURE_ENDPOINT}documentintelligence/documentModels/prebuilt-read:analyze?api-version=${API_VERSION}`;
        
        const analyzeResponse = await helpers.httpRequest({
            method: 'POST',
            url: analyzeUrl,
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
                'Content-Type': 'application/octet-stream'
            },
            body: imageBuffer,
            encoding: 'binary',
            returnFullResponse: true
        });
        
        if (!analyzeResponse.headers || !analyzeResponse.headers['operation-location']) {
            throw new Error('No operation-location header in response');
        }
        
        const operationLocation = analyzeResponse.headers['operation-location'];
        console.log(`Analysis started. Operation URL: ${operationLocation}`);
        
        // Poll for results
        let attempts = 0;
        const maxAttempts = 30;
        const delay = 2000;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
            
            const resultResponse = await helpers.httpRequest({
                method: 'GET',
                url: operationLocation,
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_API_KEY
                },
                json: true
            });
            
            if (resultResponse.status === 'succeeded' && resultResponse.analyzeResult) {
                console.log('Analysis succeeded');
                
                // Extract text from pages
                const pages = resultResponse.analyzeResult.pages || [];
                let extractedText = [];
                
                for (const page of pages) {
                    if (page.lines) {
                        for (const line of page.lines) {
                            if (line.content) {
                                extractedText.push(line.content);
                            }
                        }
                    }
                }
                
                const text = extractedText.join('\n').trim();
                console.log(`Extracted ${text.length} characters from ${attachment.name}`);
                return text || '[No text found in image]';
            } else if (resultResponse.status === 'failed') {
                throw new Error(`Analysis failed: ${resultResponse.error?.message || 'Unknown error'}`);
            }
            
            attempts++;
        }
        
        throw new Error('Analysis timed out after ' + (maxAttempts * delay / 1000) + ' seconds');
        
    } catch (error) {
        console.error(`Error processing ${attachment.name}:`, error.message);
        return `[OCR processing error: ${error.message}. Unable to extract text from the image at this time.]`;
    }
}

// Process all attachments
let allExtractedText = [];
let processedCount = 0;

// Get helpers from the context
const helpers = this.helpers;

for (const attachment of attachments) {
    if (attachment.isScreenshot || attachment.type?.includes('image')) {
        const attachmentType = attachment.isScreenshot ? 'Screenshot' : 'Image';
        const extractedText = await extractTextFromImage(attachment, helpers);
        allExtractedText.push(`\n=== ${attachmentType}: "${attachment.name}" ===\n${extractedText}`);
        if (!extractedText.includes('[OCR processing error')) {
            processedCount++;
        }
    } else if (attachment.type?.includes('pdf') || attachment.name?.endsWith('.pdf')) {
        const extractedText = await extractTextFromImage(attachment, helpers);
        allExtractedText.push(`\n=== PDF Document: "${attachment.name}" ===\n${extractedText}`);
        if (!extractedText.includes('[OCR processing error')) {
            processedCount++;
        }
    } else {
        allExtractedText.push(`\n=== Document: "${attachment.name}" ===\n[Unsupported file type: ${attachment.type}]`);
    }
}

// Compile results
const extractedContent = allExtractedText.join('\n');
result.extractedContent = extractedContent;
result.processedAttachments = processedCount;

// Update chat input with extracted content
if (extractedContent && extractedContent.length > 0) {
    const userQuery = data.message || data.userMessage || '';
    result.chatInput = `User asked: "${userQuery}"\n\nContent from attached files:\n${extractedContent}\n\nPlease analyze the content above and provide a helpful response to the user's question.`;
}

// Preserve all original data in body
result.body = data;
result.body.extractedContent = extractedContent;
result.body.processedAttachments = processedCount;

console.log(`Completed processing. Extracted content from ${processedCount} of ${attachments.length} attachments`);

return result;