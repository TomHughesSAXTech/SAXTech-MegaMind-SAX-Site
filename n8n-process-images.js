// n8n Code node to process pasted images/screenshots
// Add this as a new Code node after Prepare Context, before AI Agent

const inputData = $input.all()[0].json;
const attachments = inputData.attachments || [];
let extractedText = '';

// Process any screenshots or images
for (const attachment of attachments) {
    if (attachment.data && attachment.type && attachment.type.includes('image')) {
        // For n8n, you'd need to:
        // 1. Use an OCR service (Azure Computer Vision, Google Vision, etc.)
        // 2. Or use a simpler approach with n8n's HTTP Request node to call an OCR API
        
        // Example structure (you'd need to implement the actual OCR call):
        if (attachment.isScreenshot) {
            extractedText += `\n[Screenshot content would be extracted here via OCR service]\n`;
            
            // In n8n, you could:
            // - Use Azure Computer Vision Read API
            // - Use Google Cloud Vision API
            // - Use Tesseract via a webhook
        }
    }
}

// Add extracted text to the context
const enhancedContext = {
    ...inputData,
    extractedImageText: extractedText,
    hasScreenshots: attachments.some(a => a.isScreenshot),
    // Add to the message if we extracted text
    enhancedMessage: extractedText ? 
        `${inputData.message}\n\n[Attached Screenshot Context: ${extractedText}]` : 
        inputData.message
};

return [{
    json: enhancedContext
}];