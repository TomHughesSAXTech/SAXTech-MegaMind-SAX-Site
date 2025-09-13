// n8n Code Node - Add this AFTER your Webhook node, BEFORE your existing AI processing
// This processes pasted images using Azure Computer Vision OCR

const inputData = $input.all()[0].json;
const attachments = inputData.attachments || [];

// Azure Computer Vision Configuration
const VISION_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const VISION_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';
const OCR_API_PATH = 'vision/v3.2/ocr';

let extractedText = '';
let processedImages = [];

// Check if there are any screenshots in the attachments
const hasScreenshots = attachments.some(a => a.isScreenshot && a.data);

if (hasScreenshots) {
    // Process each screenshot
    for (const attachment of attachments) {
        if (attachment.isScreenshot && attachment.data) {
            try {
                // Extract base64 data (remove data:image/png;base64, prefix)
                const base64Data = attachment.data.replace(/^data:image\/[a-z]+;base64,/, '');
                
                // Convert base64 to binary buffer
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
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
                    extractedText += `\n--- Content from ${attachment.name} ---\n${imageText.trim()}\n`;
                    processedImages.push({
                        name: attachment.name,
                        extractedText: imageText.trim()
                    });
                }
                
            } catch (error) {
                console.error(`Error processing image ${attachment.name}:`, error.message);
                // Continue processing other images even if one fails
            }
        }
    }
}

// Enhance the message with OCR content
let enhancedMessage = inputData.message || '';

if (extractedText) {
    // Add extracted text to the message context
    enhancedMessage = `${inputData.message || ''}

[Screenshot Content Detected - OCR Extracted Text:]
${extractedText}

Please consider the screenshot content above when formulating your response.`;
}

// Return the enhanced data for the next node
return [{
    json: {
        ...inputData,
        message: enhancedMessage,  // Replace message with enhanced version
        originalMessage: inputData.message,  // Keep original for reference
        extractedImageText: extractedText,
        processedImages: processedImages,
        hasScreenshots: hasScreenshots,
        ocrProcessed: !!extractedText
    }
}];