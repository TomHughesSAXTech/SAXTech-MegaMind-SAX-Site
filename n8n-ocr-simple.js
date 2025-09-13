// Simplified OCR Processing for n8n Code Node
// Add this AFTER Webhook, BEFORE Prepare Context

const inputData = $input.all()[0].json;
const attachments = inputData.attachments || [];

console.log('OCR Node - Input received:', {
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length
});

// Check for screenshots
const screenshots = attachments.filter(a => a.isScreenshot && a.data);
console.log('OCR Node - Screenshots found:', screenshots.length);

if (screenshots.length > 0) {
    console.log('OCR Node - Processing screenshots...');
    
    // For now, just acknowledge we have the image data
    // The OCR API call would go here
    const imageInfo = screenshots.map(s => ({
        name: s.name,
        size: s.size,
        hasData: !!s.data,
        dataLength: s.data ? s.data.length : 0
    }));
    
    console.log('OCR Node - Image info:', imageInfo);
    
    // Enhanced message with placeholder for OCR
    const enhancedMessage = `${inputData.message || ''}

[Screenshot detected: ${screenshots[0].name}]
[Image size: ${screenshots[0].size} bytes]
[Note: OCR processing will be added here to extract text from the image]

The user has shared a screenshot. Once OCR is configured, I will be able to read its contents.`;

    return [{
        json: {
            ...inputData,
            message: enhancedMessage,
            originalMessage: inputData.message,
            hasScreenshots: true,
            screenshotCount: screenshots.length,
            ocrStatus: 'pending_configuration'
        }
    }];
} else {
    // No screenshots, pass through unchanged
    console.log('OCR Node - No screenshots, passing through');
    return [{
        json: inputData
    }];
}