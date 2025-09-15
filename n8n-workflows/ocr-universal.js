// Universal OCR Processing for Screenshots and Document Attachments
// Works with multiple n8n versions

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
    result.body = data;
    return result;
}

console.log(`Processing ${attachments.length} attachments`);

// Helper function to decode base64
function decodeBase64(base64String) {
    const base64Data = base64String.replace(/^data:.*?;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

// Try to detect which HTTP method is available
let httpMethod = null;
let httpRequest = null;

// Try different methods to find what's available
try {
    // Method 1: Try $helpers.httpRequest (newer n8n)
    if (typeof $helpers !== 'undefined' && $helpers.httpRequest) {
        httpMethod = '$helpers';
        httpRequest = $helpers.httpRequest;
        console.log('Using $helpers.httpRequest');
    }
} catch (e1) {
    console.log('$helpers not available');
}

if (!httpMethod) {
    try {
        // Method 2: Try this.helpers.httpRequest (some n8n versions)
        if (typeof this !== 'undefined' && this.helpers && this.helpers.httpRequest) {
            httpMethod = 'this.helpers';
            httpRequest = this.helpers.httpRequest;
            console.log('Using this.helpers.httpRequest');
        }
    } catch (e2) {
        console.log('this.helpers not available');
    }
}

if (!httpMethod) {
    try {
        // Method 3: Try $http (some n8n versions)
        if (typeof $http !== 'undefined') {
            httpMethod = '$http';
            console.log('Using $http');
        }
    } catch (e3) {
        console.log('$http not available');
    }
}

// Function to make HTTP request based on available method
async function makeHttpRequest(options) {
    if (httpMethod === '$helpers' || httpMethod === 'this.helpers') {
        return await httpRequest(options);
    } else if (httpMethod === '$http') {
        if (options.method === 'POST') {
            return await $http.post(options.url, options.body, {
                headers: options.headers,
                returnFullResponse: options.returnFullResponse
            });
        } else {
            return await $http.get(options.url, {
                headers: options.headers
            });
        }
    } else {
        throw new Error('No HTTP method available in this n8n version');
    }
}

// Function to extract text from image
async function extractTextFromImage(attachment) {
    try {
        if (!httpMethod) {
            throw new Error('No HTTP request method available. Please use HTTP Request nodes instead.');
        }
        
        console.log(`Processing attachment: ${attachment.name}`);
        
        const imageBuffer = decodeBase64(attachment.data);
        
        // Start analysis
        const analyzeUrl = `${AZURE_ENDPOINT}documentintelligence/documentModels/prebuilt-read:analyze?api-version=${API_VERSION}`;
        
        const analyzeResponse = await makeHttpRequest({
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
        
        const operationLocation = analyzeResponse.headers['operation-location'];
        if (!operationLocation) {
            throw new Error('No operation-location header in response');
        }
        
        console.log(`Analysis started. Polling for results...`);
        
        // Poll for results
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const resultResponse = await makeHttpRequest({
                method: 'GET',
                url: operationLocation,
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_API_KEY
                },
                json: true
            });
            
            if (resultResponse.status === 'succeeded' && resultResponse.analyzeResult) {
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
                console.log(`Extracted ${text.length} characters`);
                return text || '[No text found in image]';
            } else if (resultResponse.status === 'failed') {
                throw new Error('OCR analysis failed');
            }
            
            attempts++;
        }
        
        throw new Error('OCR analysis timed out');
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return `[OCR error: ${error.message}]`;
    }
}

// Process attachments
let allExtractedText = [];
let processedCount = 0;

// If no HTTP method is available, return data for external processing
if (!httpMethod) {
    console.log('No HTTP method available - preparing data for external HTTP Request nodes');
    
    const attachmentsToProcess = [];
    for (const attachment of attachments) {
        if (attachment.isScreenshot || attachment.type?.includes('image')) {
            const base64Data = attachment.data.replace(/^data:.*?;base64,/, '');
            attachmentsToProcess.push({
                name: attachment.name,
                type: attachment.type,
                isScreenshot: attachment.isScreenshot,
                base64Data: base64Data,
                binaryData: Buffer.from(base64Data, 'base64').toString('base64')
            });
        }
    }
    
    result.attachmentsToProcess = attachmentsToProcess;
    result.extractedContent = '[OCR requires HTTP Request nodes - no HTTP method available in Code node]';
    result.needsExternalProcessing = true;
    result.body = data;
    
    return result;
}

// Process with available HTTP method
for (const attachment of attachments) {
    if (attachment.isScreenshot || attachment.type?.includes('image')) {
        const attachmentType = attachment.isScreenshot ? 'Screenshot' : 'Image';
        const extractedText = await extractTextFromImage(attachment);
        allExtractedText.push(`\n=== ${attachmentType}: "${attachment.name}" ===\n${extractedText}`);
        if (!extractedText.includes('[OCR error')) {
            processedCount++;
        }
    }
}

// Compile results
const extractedContent = allExtractedText.join('\n');
result.extractedContent = extractedContent;
result.processedAttachments = processedCount;

if (extractedContent && extractedContent.length > 0) {
    const userQuery = data.message || data.userMessage || '';
    result.chatInput = `User asked: "${userQuery}"\n\nContent from attached files:\n${extractedContent}\n\nPlease analyze the content above and provide a helpful response to the user's question.`;
}

result.body = data;
result.body.extractedContent = extractedContent;
result.body.processedAttachments = processedCount;

console.log(`Completed processing. Extracted content from ${processedCount} of ${attachments.length} attachments`);

return result;