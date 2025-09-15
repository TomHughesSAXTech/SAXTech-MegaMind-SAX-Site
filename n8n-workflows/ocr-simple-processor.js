// OCR Processing for Screenshots - Simplified Version for older n8n
// This version prepares data for external HTTP Request nodes

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
    attachmentsToProcess: [],
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

console.log(`Found ${attachments.length} attachments to process`);

// Process each attachment and prepare for OCR
for (const attachment of attachments) {
    if (attachment.isScreenshot || attachment.type?.includes('image') || attachment.type?.includes('pdf')) {
        // Remove data URL prefix and get just the base64 data
        const base64Data = attachment.data.replace(/^data:.*?;base64,/, '');
        
        // Add to processing queue
        result.attachmentsToProcess.push({
            name: attachment.name,
            type: attachment.type,
            isScreenshot: attachment.isScreenshot || false,
            base64Data: base64Data,
            // Convert base64 to binary for Azure API
            binaryData: Buffer.from(base64Data, 'base64')
        });
    }
}

// If we have attachments to process, set up the extracted content placeholder
if (result.attachmentsToProcess.length > 0) {
    // Placeholder text while OCR processing happens in next nodes
    const placeholderText = result.attachmentsToProcess.map(att => {
        const type = att.isScreenshot ? 'Screenshot' : (att.type?.includes('pdf') ? 'PDF Document' : 'Image');
        return `\n=== ${type}: "${att.name}" ===\n[OCR processing pending - will be handled by HTTP Request node]`;
    }).join('\n');
    
    result.extractedContent = placeholderText;
    result.chatInput = `User asked: "${data.message || data.userMessage || ''}"\n\nContent from attached files:\n${placeholderText}\n\nPlease analyze the content above and provide a helpful response to the user's question.`;
}

// Preserve all original data in body
result.body = data;

console.log(`Prepared ${result.attachmentsToProcess.length} attachments for OCR processing`);

// Return the data - the actual OCR will be done by HTTP Request nodes
return result;