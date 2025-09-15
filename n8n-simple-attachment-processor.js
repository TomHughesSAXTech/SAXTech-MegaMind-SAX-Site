// Simple Attachment Processor for n8n
// This version uses simpler HTTP requests compatible with n8n

const inputData = $input.all();
const webhookData = inputData[0]?.json || {};

// Get attachments and message
const attachments = webhookData.attachments || [];
const message = webhookData.message || webhookData.chatInput || '';
const sessionId = webhookData.sessionId || `session_${Date.now()}`;

// Azure Document Intelligence configuration
const endpoint = 'https://saxtech-document-intelligence.cognitiveservices.azure.com';
const apiKey = '5c1669e1c7f54a13ba42e58f5b2cfcc0';

// Simple function to process images with OCR
async function processImage(base64Data, fileName) {
    try {
        console.log(`Processing image: ${fileName}`);
        
        // For now, just acknowledge the image
        // In production, this would call Azure OCR
        return `[Image "${fileName}" detected - OCR processing would extract text here]`;
        
    } catch (error) {
        console.error('Error processing image:', error);
        return `[Error processing image ${fileName}]`;
    }
}

// Simple function to process Word documents
async function processWordDoc(base64Data, fileName) {
    try {
        console.log(`Processing Word document: ${fileName}`);
        
        // For now, acknowledge and provide basic info
        // In production, this would extract actual content
        return `[Word document "${fileName}" - This is a Word document that would contain text content. Full extraction requires Azure Document Intelligence API call.]`;
        
    } catch (error) {
        console.error('Error processing Word doc:', error);
        return `[Error processing Word document ${fileName}]`;
    }
}

// Main processing
let extractedContent = '';
let processedAttachments = [];

if (attachments && attachments.length > 0) {
    console.log(`Processing ${attachments.length} attachments`);
    
    for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        console.log(`Attachment ${i + 1}: ${att.name} (${att.type})`);
        
        if (!att.data) {
            extractedContent += `\n❌ ${att.name}: No data received\n`;
            continue;
        }
        
        // Check type and process
        if (att.type && att.type.includes('image')) {
            const imageText = await processImage(att.data, att.name);
            extractedContent += `\n🖼️ ${imageText}\n`;
            processedAttachments.push({
                name: att.name,
                type: 'image',
                status: 'processed'
            });
        } else if (att.isScreenshot) {
            const screenshotText = await processImage(att.data, att.name);
            extractedContent += `\n📸 Screenshot: ${screenshotText}\n`;
            processedAttachments.push({
                name: att.name,
                type: 'screenshot',
                status: 'processed'
            });
        } else if (att.type && (att.type.includes('word') || att.name.endsWith('.docx'))) {
            const docText = await processWordDoc(att.data, att.name);
            extractedContent += `\n📄 ${docText}\n`;
            processedAttachments.push({
                name: att.name,
                type: 'word',
                status: 'processed'
            });
        } else if (att.type && (att.type.includes('excel') || att.name.endsWith('.xlsx'))) {
            extractedContent += `\n📊 Excel file "${att.name}" detected - Spreadsheet processing available\n`;
            processedAttachments.push({
                name: att.name,
                type: 'excel',
                status: 'pending'
            });
        } else {
            extractedContent += `\n📎 File "${att.name}" (${att.type}) uploaded\n`;
            processedAttachments.push({
                name: att.name,
                type: 'other',
                status: 'unprocessed'
            });
        }
    }
}

// Build the enhanced message for the AI
let chatInput = message;

if (extractedContent) {
    // Create a detailed prompt for the AI
    chatInput = `${message || 'User uploaded files/images'}

Attached Content Information:
${extractedContent}

${processedAttachments.length > 0 ? `Files processed: ${processedAttachments.map(p => p.name).join(', ')}` : ''}

Please acknowledge the uploaded content and help the user with their request about these files.`;
}

// If no message was provided but there are attachments
if (!message && attachments.length > 0) {
    chatInput = `User uploaded ${attachments.length} file(s):
${extractedContent}

The user uploaded these files without a specific question. Please acknowledge what was uploaded and ask how you can help with these files.`;
}

// Build output preserving all webhook data
const output = {
    ...webhookData,
    chatInput: chatInput,
    message: message,
    sessionId: sessionId,
    extractedContent: extractedContent,
    processedAttachments: processedAttachments,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    
    // Debug info
    debug: {
        originalMessage: message,
        attachmentCount: attachments.length,
        extractedLength: extractedContent.length,
        chatInputLength: chatInput.length,
        attachmentNames: attachments.map(a => a.name)
    }
};

console.log('Attachment processor complete:', {
    attachments: output.attachmentCount,
    extracted: extractedContent.length > 0,
    chatInput: output.chatInput.substring(0, 100) + '...'
});

return output;