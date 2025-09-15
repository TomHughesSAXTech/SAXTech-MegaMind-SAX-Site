// OCR Processing for Screenshots and Attachments
// This version uses $http which is available in older n8n versions

const items = $input.all();
const processedItems = [];

for (const item of items) {
  try {
    const sessionId = item.json.sessionId || 'unknown';
    const attachments = item.json.attachments || [];
    
    if (!attachments || attachments.length === 0) {
      processedItems.push({
        json: {
          ...item.json,
          extractedContent: '',
          processedAttachments: 0,
          hasAttachments: false
        }
      });
      continue;
    }

    let extractedContent = '';
    let processedCount = 0;

    for (const attachment of attachments) {
      if (attachment.isScreenshot || attachment.type?.startsWith('image/')) {
        try {
          // Extract base64 data
          const base64Match = attachment.data.match(/base64,(.+)/);
          if (!base64Match) {
            extractedContent += `\n=== Screenshot: "${attachment.name}" ===\n[Error: Invalid image data format]\n`;
            continue;
          }

          const base64Data = base64Match[1];
          
          // Convert base64 to binary
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Azure Document Intelligence configuration
          const endpoint = 'https://saxtech-docintelligence.cognitiveservices.azure.com';
          const apiKey = '6qQ5TxPKygKbmPhgwkoTDT51qf6yRWH4iUWroiBLm562TlcM1b24JQQJ99BHACHYHv6XJ3w3AAALACOGZyAP';
          const apiVersion = '2024-02-29-preview';

          // Step 1: Submit document for analysis
          const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
          
          const analyzeResponse = await $http.post(analyzeUrl, 
            bytes.buffer,
            {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key': apiKey
              },
              timeout: 30000,
              responseType: 'json'
            }
          );

          // Get operation location from headers
          const operationLocation = analyzeResponse.headers['operation-location'] || 
                                   analyzeResponse.headers['Operation-Location'];
          
          if (!operationLocation) {
            throw new Error('No operation location returned from Azure');
          }

          // Step 2: Poll for results
          let result = null;
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const statusResponse = await $http.get(operationLocation, {
              headers: {
                'Ocp-Apim-Subscription-Key': apiKey
              },
              timeout: 30000,
              responseType: 'json'
            });

            if (statusResponse.data.status === 'succeeded') {
              result = statusResponse.data;
              break;
            } else if (statusResponse.data.status === 'failed') {
              throw new Error('Document analysis failed');
            }
            
            attempts++;
          }

          if (!result) {
            throw new Error('Document analysis timed out');
          }

          // Step 3: Extract text from results
          let ocrText = '';
          
          if (result.analyzeResult && result.analyzeResult.paragraphs) {
            ocrText = result.analyzeResult.paragraphs
              .map(p => p.content)
              .join('\n');
          } else if (result.analyzeResult && result.analyzeResult.content) {
            ocrText = result.analyzeResult.content;
          }

          if (ocrText) {
            extractedContent += `\n=== Screenshot: "${attachment.name}" ===\n${ocrText}\n`;
          } else {
            extractedContent += `\n=== Screenshot: "${attachment.name}" ===\n[No text detected in image]\n`;
          }
          
          processedCount++;
          
        } catch (error) {
          console.error('OCR Error:', error);
          extractedContent += `\n=== Screenshot: "${attachment.name}" ===\n[OCR processing error: ${error.message}. Unable to extract text from the image at this time.]\n`;
        }
      } else if (attachment.type?.includes('text') || attachment.type?.includes('json')) {
        // Handle text attachments
        try {
          const textContent = attachment.data;
          extractedContent += `\n=== Text Attachment: "${attachment.name}" ===\n${textContent}\n`;
          processedCount++;
        } catch (error) {
          extractedContent += `\n=== Text Attachment: "${attachment.name}" ===\n[Error reading text content]\n`;
        }
      }
    }

    // Prepare the chat input with extracted content
    const userMessage = item.json.message || '';
    let chatInput = '';
    
    if (extractedContent) {
      chatInput = `User asked: "${userMessage}"\n\nContent from attached files:\n${extractedContent}\n\nPlease analyze the content above and provide a helpful response to the user's question.`;
    } else {
      chatInput = userMessage;
    }

    processedItems.push({
      json: {
        ...item.json,
        userMessage: userMessage,
        chatInput: chatInput,
        extractedContent: extractedContent,
        processedAttachments: processedCount,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        processingStatus: {
          attachmentsReceived: attachments.length,
          attachmentsProcessed: processedCount,
          hasExtractedContent: extractedContent.length > 0,
          chatInputLength: chatInput.length,
          errors: []
        }
      }
    });
    
  } catch (error) {
    processedItems.push({
      json: {
        ...item.json,
        error: error.message,
        extractedContent: '',
        processedAttachments: 0
      }
    });
  }
}

return processedItems;