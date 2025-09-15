// Fixed Copy Pasta Screenshots and Attachments Node
// This version correctly accesses attachments from the body field

const inputData = $input.all()[0].json;
console.log('=== COPY PASTA START ===');
console.log('Input structure:', Object.keys(inputData));
console.log('SessionId locations:', {
  topLevel: inputData.sessionId,
  inBody: inputData.body ? inputData.body.sessionId : 'no body field'
});

// Get the actual message and attachments from the correct location
let userMessage = '';
let attachments = [];

// Check multiple possible locations for the data
if (inputData.body) {
  console.log('Found body field');
  userMessage = inputData.body.message || '';
  attachments = inputData.body.attachments || [];
} else {
  console.log('No body field, checking direct fields');
  userMessage = inputData.message || inputData.userMessage || '';
  attachments = inputData.attachments || [];
}

// If message looks like a context message, extract the real user message
if (userMessage.includes('[Context: User has')) {
  console.log('Message is a context wrapper, looking for real message');
  // For screenshot pastes, the user message might be empty initially
  // We'll use a default message
  userMessage = "What's in this image?";
}

console.log('User message:', userMessage);
console.log('Attachments found:', attachments.length);

let processedContent = [];
let errors = [];

// Process each attachment
for (let i = 0; i < attachments.length; i++) {
  const attachment = attachments[i];
  console.log(`Processing attachment ${i + 1}:`, {
    type: attachment.type,
    name: attachment.name,
    hasData: !!attachment.data,
    dataLength: attachment.data ? attachment.data.length : 0,
    isScreenshot: attachment.isScreenshot
  });
  
  try {
    if (attachment.type && attachment.type.startsWith('image/')) {
      // Extract base64 data
      let base64Data = attachment.data;
      if (base64Data && base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      
      // For now, acknowledge the image and simulate OCR
      const screenshotType = attachment.isScreenshot ? 'Screenshot' : 'Image';
      const imageName = attachment.name || 'unnamed';
      
      processedContent.push(`[${screenshotType} "${imageName}" detected]`);
      
      // TODO: Add actual Azure OCR call here
      // For now, let's add placeholder content
      processedContent.push(`[Content extraction pending for ${screenshotType.toLowerCase()}]`);
      
      // Log that we have the image data
      console.log(`Image base64 data length: ${base64Data ? base64Data.length : 0}`);
      
    } else if (attachment.name && (attachment.name.endsWith('.docx') || attachment.name.endsWith('.doc'))) {
      // Handle Word documents
      processedContent.push(`[Word document "${attachment.name}" detected]`);
      processedContent.push(`[Document content extraction pending]`);
      
    } else if (attachment.name && attachment.name.endsWith('.pdf')) {
      // Handle PDFs
      processedContent.push(`[PDF document "${attachment.name}" detected]`);
      processedContent.push(`[PDF content extraction pending]`);
      
    } else {
      // Other file types
      const fileName = attachment.name || 'unnamed file';
      processedContent.push(`[File "${fileName}" detected - type: ${attachment.type || 'unknown'}]`);
    }
  } catch (error) {
    const errorMsg = `Error processing attachment ${i + 1}: ${error.message}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    processedContent.push(`[Error processing attachment: ${error.message}]`);
  }
}

// Build the final chatInput
let finalChatInput = '';

if (processedContent.length > 0) {
  // When we have attachments, combine the user message with processed content
  finalChatInput = `User's message: "${userMessage}"

Attached content:
${processedContent.join('\n')}

Please analyze the attached content and respond to the user's query about it.`;
} else {
  // No attachments, just use the user message
  finalChatInput = userMessage;
}

console.log('=== FINAL CHATINPUT ===');
console.log(finalChatInput);
console.log('=== END CHATINPUT ===');

// Create the output - preserve all original data and add our processed fields
// Make sure to preserve sessionId and other important fields
const output = {
  ...inputData,
  // Preserve sessionId from body or top level
  sessionId: inputData.sessionId || (inputData.body && inputData.body.sessionId) || '',
  // Add our processed fields
  userMessage: userMessage,
  chatInput: finalChatInput,
  extractedContent: processedContent.join('\n'),
  processedAttachments: attachments.length,
  hasAttachments: attachments.length > 0,
  attachmentCount: attachments.length,
  processingStatus: {
    attachmentsReceived: attachments.length,
    attachmentsProcessed: processedContent.length,
    hasExtractedContent: processedContent.length > 0,
    chatInputLength: finalChatInput.length,
    errors: errors
  }
};

// Ensure sessionId is preserved at the top level
if (inputData.body && inputData.body.sessionId && !output.sessionId) {
  output.sessionId = inputData.body.sessionId;
}

console.log('=== OUTPUT SUMMARY ===');
console.log('Output chatInput length:', output.chatInput.length);
console.log('Attachments processed:', output.processedAttachments);
console.log('Has extracted content:', output.processingStatus.hasExtractedContent);
console.log('Output sessionId:', output.sessionId);
console.log('=== COPY PASTA END ===');

return output;