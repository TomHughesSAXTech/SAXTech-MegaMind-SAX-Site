// OCR Passthrough - Keeps workflow running while OCR is being fixed
// This version passes data through without OCR processing to avoid errors

// Get the webhook data
const webhookData = $input.first().json;
const data = webhookData.body || webhookData;

// Initialize result with all necessary fields
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

// Create a message about the attachments without actually processing them
if (attachments && attachments.length > 0) {
    let attachmentInfo = [];
    
    for (const attachment of attachments) {
        if (attachment.isScreenshot) {
            attachmentInfo.push(`Screenshot: ${attachment.name}`);
        } else if (attachment.type?.includes('image')) {
            attachmentInfo.push(`Image: ${attachment.name}`);
        } else if (attachment.type?.includes('pdf')) {
            attachmentInfo.push(`PDF: ${attachment.name}`);
        } else {
            attachmentInfo.push(`File: ${attachment.name}`);
        }
    }
    
    // Create a descriptive message about what was received
    const attachmentList = attachmentInfo.join(', ');
    const userQuery = data.message || data.userMessage || '';
    
    // Update the chat input to acknowledge the attachments
    result.chatInput = userQuery || `User shared ${attachments.length} file(s): ${attachmentList}. [Note: OCR processing is temporarily unavailable. Please describe what you need help with regarding these files.]`;
    
    result.extractedContent = `[Received ${attachments.length} attachment(s): ${attachmentList}. OCR processing is being upgraded.]`;
} else {
    // No attachments, just pass through the message
    result.chatInput = data.message || data.userMessage || '';
}

// Preserve all original data in body
result.body = data;

// Log what we're doing
console.log(`Passthrough mode: ${attachments.length} attachment(s) acknowledged but not processed`);

return result;