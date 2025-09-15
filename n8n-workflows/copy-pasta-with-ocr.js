// Copy Pasta Screenshots and Attachments Node with Azure OCR
// This version includes actual Azure Document Intelligence OCR

const inputData = $input.all()[0].json;
console.log('=== COPY PASTA WITH OCR START ===');
console.log('Input structure:', Object.keys(inputData));
console.log('SessionId locations:', {
  topLevel: inputData.sessionId,
  inBody: inputData.body ? inputData.body.sessionId : 'no body field'
});

// Azure Document Intelligence configuration
// You'll need to set these in n8n environment variables or directly here
const AZURE_ENDPOINT = 'https://saxdocumentintelligence.cognitiveservices.azure.com/';
const AZURE_API_KEY = '6967b9e6f88142c8ac79b960ab3e1b32';
const AZURE_API_VERSION = '2024-02-29-preview';

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
  userMessage = "What's in this image?";
}

console.log('User message:', userMessage);
console.log('Attachments found:', attachments.length);

// Helper function to perform OCR using Azure Document Intelligence
async function performOCR(base64Data, fileName) {
  try {
    console.log(`Starting OCR for ${fileName}`);
    
    // Remove data URL prefix if present
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // Convert base64 to binary
    const binaryData = Buffer.from(base64Data, 'base64');
    
    // Start the analyze operation
    const analyzeUrl = `${AZURE_ENDPOINT}documentintelligence/documentModels/prebuilt-read:analyze?api-version=${AZURE_API_VERSION}`;
    
    const analyzeResponse = await $http.post(analyzeUrl, 
      binaryData,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
          'Content-Type': 'application/octet-stream'
        },
        resolveWithFullResponse: true,
        timeout: 30000
      }
    );
    
    // Get the operation location from headers
    const operationLocation = analyzeResponse.headers['operation-location'] || 
                            analyzeResponse.headers['Operation-Location'];
    
    if (!operationLocation) {
      throw new Error('No operation-location header in response');
    }
    
    console.log(`OCR operation started for ${fileName}, polling for results...`);
    
    // Poll for results
    let result = null;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await $http.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_API_KEY
        }
      });
      
      if (statusResponse.status === 'succeeded') {
        result = statusResponse.analyzeResult;
        break;
      } else if (statusResponse.status === 'failed') {
        throw new Error('OCR operation failed');
      }
      
      attempts++;
    }
    
    if (!result) {
      throw new Error('OCR operation timed out');
    }
    
    // Extract text from the result
    let extractedText = '';
    if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        if (page.lines) {
          for (const line of page.lines) {
            extractedText += line.content + '\n';
          }
        }
      }
    }
    
    if (!extractedText) {
      extractedText = '[No text detected in image]';
    }
    
    console.log(`OCR completed for ${fileName}, extracted ${extractedText.length} characters`);
    return extractedText.trim();
    
  } catch (error) {
    console.error(`OCR failed for ${fileName}:`, error.message);
    // Return a fallback message instead of throwing
    return `[OCR processing failed: ${error.message}. The image may not contain readable text or there may be a service issue.]`;
  }
}

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
      const screenshotType = attachment.isScreenshot ? 'Screenshot' : 'Image';
      const imageName = attachment.name || 'unnamed';
      
      // Perform actual OCR
      console.log(`Attempting OCR for ${imageName}...`);
      const ocrText = await performOCR(attachment.data, imageName);
      
      // Add the results to processed content
      processedContent.push(`[${screenshotType} "${imageName}" content]:`);
      processedContent.push(ocrText);
      processedContent.push('---'); // Separator between attachments
      
    } else if (attachment.name && (attachment.name.endsWith('.docx') || attachment.name.endsWith('.doc'))) {
      // For Word documents, we could use Document Intelligence as well
      processedContent.push(`[Word document "${attachment.name}" detected]`);
      
      // Try to extract with Document Intelligence
      try {
        const docText = await performOCR(attachment.data, attachment.name);
        processedContent.push(docText);
      } catch (err) {
        processedContent.push(`[Document extraction not available: ${err.message}]`);
      }
      processedContent.push('---');
      
    } else if (attachment.name && attachment.name.endsWith('.pdf')) {
      // PDFs can also be processed with Document Intelligence
      processedContent.push(`[PDF document "${attachment.name}" detected]`);
      
      try {
        const pdfText = await performOCR(attachment.data, attachment.name);
        processedContent.push(pdfText);
      } catch (err) {
        processedContent.push(`[PDF extraction not available: ${err.message}]`);
      }
      processedContent.push('---');
      
    } else {
      // Other file types
      const fileName = attachment.name || 'unnamed file';
      processedContent.push(`[File "${fileName}" detected - type: ${attachment.type || 'unknown'}]`);
      processedContent.push('---');
    }
  } catch (error) {
    const errorMsg = `Error processing attachment ${i + 1}: ${error.message}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    processedContent.push(`[Error processing attachment: ${error.message}]`);
    processedContent.push('---');
  }
}

// Remove the last separator if present
if (processedContent[processedContent.length - 1] === '---') {
  processedContent.pop();
}

// Build the final chatInput
let finalChatInput = '';

if (processedContent.length > 0) {
  // When we have attachments, combine the user message with extracted content
  finalChatInput = `User asked: "${userMessage}"

Content extracted from attached files:

${processedContent.join('\n')}

Please analyze the extracted content above and provide a helpful response to the user's question.`;
} else {
  // No attachments, just use the user message
  finalChatInput = userMessage;
}

console.log('=== FINAL CHATINPUT ===');
console.log(finalChatInput.substring(0, 500) + (finalChatInput.length > 500 ? '...' : ''));
console.log(`Total chatInput length: ${finalChatInput.length} characters`);
console.log('=== END CHATINPUT ===');

// Create the output - preserve all original data and add our processed fields
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
console.log('Errors:', errors);
console.log('=== COPY PASTA WITH OCR END ===');

return output;