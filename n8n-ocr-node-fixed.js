// Process pasted images using Azure Computer Vision OCR
const inputData = $input.all()[0].json;
const attachments = inputData.body?.attachments || inputData.attachments || [];

// Azure Computer Vision Configuration
const VISION_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const VISION_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';
const OCR_API_PATH = 'vision/v3.2/ocr';

let extractedText = '';
let processedImages = [];

// Debug logging
console.log('Attachments found:', attachments.length);
console.log('First attachment:', attachments[0] ? {
    name: attachments[0].name,
    type: attachments[0].type,
    isScreenshot: attachments[0].isScreenshot,
    hasData: !!attachments[0].data
} : 'None');

// Check if there are any screenshots in the attachments
const hasScreenshots = attachments.some(a => a.isScreenshot && a.data);

console.log('Has screenshots:', hasScreenshots);

if (hasScreenshots) {
    for (const attachment of attachments) {
        if (attachment.isScreenshot && attachment.data) {
            try {
                console.log(`Processing screenshot: ${attachment.name}`);
                
                // Extract base64 data
                const base64Data = attachment.data.replace(/^data:image\/[a-z]+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                console.log(`Image buffer size: ${imageBuffer.length} bytes`);
                
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
                
                console.log('OCR Response received');
                
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
                
                console.log(`Extracted text length: ${imageText.length} characters`);
                
                if (imageText) {
                    extractedText += `\n--- Content from ${attachment.name} ---\n${imageText.trim()}\n`;
                    processedImages.push({
                        name: attachment.name,
                        text: imageText.trim()
                    });
                } else {
                    console.log('No text found in image');
                }
                
            } catch (error) {
                console.error(`Error processing image ${attachment.name}:`, error.message);
                // Continue processing other images even if one fails
            }
        }
    }
}

// Get the original message from the correct location
const originalMessage = inputData.body?.message || inputData.message || '';

// Enhance the message with OCR content
let enhancedMessage = originalMessage;
if (extractedText) {
    // Remove any existing OCR placeholder text
    enhancedMessage = originalMessage.replace(/\[Context: User has pasted.*?\]/g, '').trim();
    
    // Add the extracted text
    enhancedMessage = `${enhancedMessage}

[Screenshot Content (OCR Extracted)]:
${extractedText}

Please analyze the screenshot content above and respond accordingly.`;
}

console.log('Enhanced message created, length:', enhancedMessage.length);

// Pass all the original data through, just updating the message
const outputData = {
    ...inputData.body || inputData,
    message: enhancedMessage,
    originalMessage: originalMessage,
    extractedImageText: extractedText,
    hasScreenshots: hasScreenshots,
    ocrProcessed: !!extractedText,
    processedImages: processedImages,
    attachments: attachments // Keep original attachments
};

// Return the enhanced data
return [{
    json: outputData
}];