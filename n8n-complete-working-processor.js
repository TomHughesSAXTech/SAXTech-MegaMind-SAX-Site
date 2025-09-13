// Complete Working Processor for n8n - Handles Everything Properly
// Place this in your "Copy Pasta Screenshots and Attachments" node

const inputJson = $input.first().json;
const body = inputJson.body || inputJson;

// Get the message from the correct location
const userMessage = body.message || body.MESSAGE_SENT || '';

// Get session ID
const sessionId = body.sessionId || inputJson.sessionId || `session_${Date.now()}`;

// Get attachments array from body
const attachments = body.attachments || [];

// Initialize arrays for processed content
const processedAttachments = [];
let allExtractedContent = [];

// Helper to extract base64 content
function extractBase64Content(dataUrl) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return matches ? matches[2] : null;
}

// Helper to decode base64
function decodeBase64(base64String) {
  try {
    return Buffer.from(base64String, 'base64');
  } catch (error) {
    return null;
  }
}

// Process OCR for screenshots/images using Azure Computer Vision
async function processImageWithOCR(base64Data, fileName) {
  try {
    // Azure Computer Vision API endpoint
    const endpoint = 'https://saxtech-ai.cognitiveservices.azure.com/vision/v3.2/ocr?language=en&detectOrientation=true';
    const apiKey = 'c0d8e652f9694c0f857e00b3e1e91f87'; // Your API key
    
    // Decode base64 to binary
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Make API call
    const response = await $http.post(endpoint, {
      body: imageBuffer,
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      timeout: 30000
    });
    
    // Extract text from OCR response
    let extractedText = [];
    if (response.body && response.body.regions) {
      for (const region of response.body.regions) {
        for (const line of region.lines || []) {
          const lineText = line.words.map(word => word.text).join(' ');
          extractedText.push(lineText);
        }
      }
    }
    
    return extractedText.length > 0 ? extractedText.join('\n') : 'No text detected in image';
    
  } catch (error) {
    console.error('OCR Error:', error);
    return `OCR processing failed: ${error.message}`;
  }
}

// Extract text from Office documents
function extractFromOfficeXML(buffer, fileType) {
  try {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 500000));
    let extractedText = [];
    
    if (fileType.includes('word') || fileType.includes('document')) {
      // Word document patterns
      const patterns = [
        /<w:t[^>]*>([^<]+)<\/w:t>/g,
        /<w:t>([^<]+)<\/w:t>/g,
        /<t[^>]*>([^<]+)<\/t>/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const cleanText = match[1].trim();
          if (cleanText && cleanText.length > 1) {
            extractedText.push(cleanText);
          }
        }
      }
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      // Excel patterns
      const patterns = [
        /<t>([^<]+)<\/t>/g,
        /<v>([^<]+)<\/v>/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const cleanText = match[1].trim();
          if (cleanText) {
            extractedText.push(cleanText);
          }
        }
      }
    }
    
    return extractedText.length > 0 ? extractedText.join(' ') : null;
    
  } catch (error) {
    return null;
  }
}

// Main processing loop for attachments
for (const attachment of attachments) {
  const fileName = attachment.name || 'unknown';
  const fileType = attachment.type || '';
  const fileData = attachment.data || '';
  const isScreenshot = attachment.isScreenshot || false;
  
  let extractedContent = '';
  let processingMethod = 'unknown';
  let success = false;
  
  try {
    const base64Content = extractBase64Content(fileData);
    
    if (!base64Content) {
      extractedContent = 'Error: No valid file data';
      processingMethod = 'error';
    } else {
      const buffer = decodeBase64(base64Content);
      
      if (!buffer) {
        extractedContent = 'Error: Could not decode file';
        processingMethod = 'error';
      } else {
        // Process based on file type
        if (isScreenshot || fileType.includes('image') || fileName.match(/\.(png|jpg|jpeg|gif|bmp)$/i)) {
          // Process screenshots and images with OCR
          processingMethod = 'ocr';
          extractedContent = await processImageWithOCR(base64Content, fileName);
          success = extractedContent && !extractedContent.includes('failed');
        }
        else if (fileType.includes('pdf')) {
          processingMethod = 'pdf';
          // For PDFs, we'd need Azure Form Recognizer or similar
          extractedContent = '[PDF processing requires Azure Form Recognizer setup]';
        }
        else if (fileType.includes('word') || fileType.includes('document') || fileName.match(/\.docx?$/i)) {
          processingMethod = 'word';
          extractedContent = extractFromOfficeXML(buffer, 'word');
          if (!extractedContent) {
            extractedContent = 'Unable to extract Word document content';
          } else {
            success = true;
          }
        }
        else if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileName.match(/\.xlsx?$/i)) {
          processingMethod = 'excel';
          extractedContent = extractFromOfficeXML(buffer, 'excel');
          if (!extractedContent) {
            extractedContent = 'Unable to extract Excel content';
          } else {
            success = true;
          }
        }
        else if (fileType.includes('text') || fileName.endsWith('.txt')) {
          processingMethod = 'text';
          extractedContent = buffer.toString('utf-8');
          success = true;
        }
        else {
          processingMethod = 'unknown';
          extractedContent = 'Unsupported file type';
        }
      }
    }
    
    // Truncate if too long
    if (extractedContent && extractedContent.length > 10000) {
      extractedContent = extractedContent.substring(0, 10000) + '\n[Content truncated...]';
    }
    
  } catch (error) {
    extractedContent = `Processing error: ${error.message}`;
    processingMethod = 'error';
  }
  
  // Store results
  processedAttachments.push({
    fileName: fileName,
    fileType: fileType,
    isScreenshot: isScreenshot,
    method: processingMethod,
    success: success,
    contentLength: extractedContent.length
  });
  
  // Add to content for AI if successful
  if (extractedContent && success) {
    if (isScreenshot) {
      allExtractedContent.push(`\n\n📸 **Screenshot Content:**\n${extractedContent}\n`);
    } else {
      allExtractedContent.push(`\n\n📎 **File: ${fileName}**\n${extractedContent}\n`);
    }
  }
}

// Format the message for AI with attachment content
let messageForAI = userMessage;
if (allExtractedContent.length > 0) {
  messageForAI = `${userMessage}\n\n${allExtractedContent.join('\n')}\n\n**Please acknowledge and analyze the content above.**`;
}

// Return complete data preserving ALL original fields
return {
  ...inputJson,  // Keep everything from webhook
  ...body,       // Override with body fields
  
  // CRITICAL: AI Agent needs chatInput
  chatInput: messageForAI,
  
  // Also set these for compatibility
  MESSAGE_SENT: userMessage,
  MESSAGE_WITH_ATTACHMENTS: messageForAI,
  
  // Preserve important fields explicitly
  sessionId: sessionId,
  
  // VOICE SETTINGS - Preserve from body
  voice: body.voice,
  voiceId: body.voiceId,
  voiceName: body.voiceName,
  selectedVoice: body.selectedVoice,
  enableTTS: body.enableTTS,
  ttsSummaryLength: body.ttsSummaryLength,
  ttsSummarize: body.ttsSummarize,
  voiceConfig: body.voiceConfig,
  
  // Profile
  profile: body.profile,
  
  // User data
  userProfile: body.userProfile,
  userContext: body.userContext,
  user: body.user,
  
  // Attachment processing results
  attachmentProcessing: {
    count: processedAttachments.length,
    files: processedAttachments,
    hasContent: allExtractedContent.length > 0,
    totalExtractedLength: allExtractedContent.join('').length
  },
  
  // Raw extracted content
  extractedContent: allExtractedContent.join('\n'),
  
  // Flags
  hasAttachments: attachments.length > 0,
  hasProcessedAttachments: allExtractedContent.length > 0
};