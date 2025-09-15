// Diagnostic Copy Pasta Screenshots and Attachments Node
// This version logs extensively to help debug why content isn't reaching the AI Agent

const inputData = $input.all()[0].json;
console.log('=== COPY PASTA DIAGNOSTIC START ===');
console.log('Full input data:', JSON.stringify(inputData, null, 2));

// Check what fields we have
console.log('Available fields:', Object.keys(inputData));
console.log('Has userMessage?', !!inputData.userMessage);
console.log('Has attachments?', !!inputData.attachments);
console.log('Has chatInput?', !!inputData.chatInput);

// Initialize variables
let userMessage = inputData.userMessage || inputData.message || '';
let attachments = inputData.attachments || [];
let processedContent = [];
let errors = [];

console.log('User message:', userMessage);
console.log('Number of attachments:', attachments.length);

// Process each attachment
for (let i = 0; i < attachments.length; i++) {
  const attachment = attachments[i];
  console.log(`Processing attachment ${i + 1}:`, {
    type: attachment.type,
    hasData: !!attachment.data,
    dataLength: attachment.data ? attachment.data.length : 0,
    name: attachment.name
  });
  
  try {
    if (attachment.type && attachment.type.startsWith('image/')) {
      // For now, just acknowledge the image
      const message = `[Screenshot/Image${attachment.name ? ' "' + attachment.name + '"' : ''} provided - OCR processing would happen here]`;
      processedContent.push(message);
      console.log('Added image acknowledgment:', message);
      
      // TODO: Add actual OCR call here
      // For debugging, let's simulate what SHOULD happen:
      const simulatedOCR = '[Simulated OCR content would appear here]';
      processedContent.push(simulatedOCR);
      console.log('Added simulated OCR:', simulatedOCR);
      
    } else if (attachment.name && (attachment.name.endsWith('.docx') || attachment.name.endsWith('.doc'))) {
      // For Word documents
      const message = `[Word document "${attachment.name}" provided - content extraction would happen here]`;
      processedContent.push(message);
      console.log('Added document acknowledgment:', message);
      
      // TODO: Add actual document extraction here
      const simulatedExtraction = '[Simulated document content would appear here]';
      processedContent.push(simulatedExtraction);
      console.log('Added simulated extraction:', simulatedExtraction);
      
    } else {
      // Other file types
      const message = `[File "${attachment.name || 'unnamed'}" provided]`;
      processedContent.push(message);
      console.log('Added file acknowledgment:', message);
    }
  } catch (error) {
    const errorMsg = `Error processing attachment ${i + 1}: ${error.message}`;
    errors.push(errorMsg);
    console.error(errorMsg);
  }
}

// Build the final chatInput
let finalChatInput = userMessage;

if (processedContent.length > 0) {
  finalChatInput = `User message: "${userMessage}"

Attached content:
${processedContent.join('\n')}`;
}

console.log('=== FINAL CHATINPUT ===');
console.log(finalChatInput);
console.log('=== END CHATINPUT ===');

// Create output with extensive logging
const output = {
  ...inputData,
  chatInput: finalChatInput,
  debugInfo: {
    originalUserMessage: userMessage,
    attachmentCount: attachments.length,
    processedContentItems: processedContent.length,
    processedContent: processedContent,
    errors: errors,
    finalChatInputLength: finalChatInput.length,
    timestamp: new Date().toISOString()
  }
};

console.log('=== FINAL OUTPUT ===');
console.log('Output keys:', Object.keys(output));
console.log('chatInput field:', output.chatInput);
console.log('debugInfo:', JSON.stringify(output.debugInfo, null, 2));
console.log('=== COPY PASTA DIAGNOSTIC END ===');

return output;