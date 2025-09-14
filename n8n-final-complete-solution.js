// COMPLETE WORKING SOLUTION FOR N8N
// Put this in "Copy Pasta Screenshots and Attachments" node

const inputJson = $input.first().json;

// Extract webhook body data
const body = inputJson.body || {};
const userMessage = body.message || '';
const sessionId = body.sessionId || `session_${Date.now()}`;
const attachments = body.attachments || [];

// Process attachments
let extractedContent = [];

for (const attachment of attachments) {
  const fileName = attachment.name || 'unknown';
  const fileType = attachment.type || '';
  const fileData = attachment.data || '';
  const isScreenshot = attachment.isScreenshot || false;
  
  if (!fileData) continue;
  
  // Extract base64 content
  const base64Match = fileData.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) continue;
  
  const base64Content = base64Match[2];
  const buffer = Buffer.from(base64Content, 'base64');
  
  // Handle screenshots/images with OCR
  if (isScreenshot || fileType.includes('image')) {
    // For screenshots, we'll use the Azure Computer Vision OCR
    const ocrEndpoint = 'https://saxtech-ai.cognitiveservices.azure.com/vision/v3.2/ocr';
    const apiKey = 'c0d8e652f9694c0f857e00b3e1e91f87';
    
    try {
      const ocrResponse = await fetch(ocrEndpoint + '?language=en&detectOrientation=true', {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: buffer
      });
      
      if (ocrResponse.ok) {
        const ocrResult = await ocrResponse.json();
        let ocrText = [];
        
        if (ocrResult.regions) {
          for (const region of ocrResult.regions) {
            for (const line of region.lines || []) {
              const lineText = line.words.map(word => word.text).join(' ');
              ocrText.push(lineText);
            }
          }
        }
        
        if (ocrText.length > 0) {
          extractedContent.push(`📸 Screenshot OCR Result:\n${ocrText.join('\n')}`);
        }
      }
    } catch (e) {
      // OCR failed, but continue
    }
  }
  // Handle Word documents
  else if (fileType.includes('word') || fileName.endsWith('.docx')) {
    const text = buffer.toString('utf-8', 0, 100000);
    const matches = [];
    
    // Extract text from Word XML
    const patterns = [
      /<w:t[^>]*>([^<]+)<\/w:t>/g,
      /<w:t>([^<]+)<\/w:t>/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1].trim().length > 1) {
          matches.push(match[1].trim());
        }
      }
    }
    
    if (matches.length > 0) {
      // Remove duplicates and join
      const uniqueText = [...new Set(matches)];
      extractedContent.push(`📄 ${fileName}:\n${uniqueText.join(' ')}`);
    }
  }
  // Handle Excel files
  else if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileName.endsWith('.xlsx')) {
    const text = buffer.toString('utf-8', 0, 100000);
    const matches = [];
    
    // Extract from Excel XML
    const patterns = [
      /<t>([^<]+)<\/t>/g,
      /<v>([^<]+)<\/v>/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1].trim()) {
          matches.push(match[1].trim());
        }
      }
    }
    
    if (matches.length > 0) {
      const uniqueText = [...new Set(matches)];
      extractedContent.push(`📊 ${fileName}:\n${uniqueText.slice(0, 100).join(' | ')}`);
    }
  }
  // Handle text files
  else if (fileType.includes('text') || fileName.endsWith('.txt')) {
    const text = buffer.toString('utf-8');
    extractedContent.push(`📝 ${fileName}:\n${text.substring(0, 5000)}`);
  }
}

// Build the final message for AI
let finalMessage = userMessage;
if (extractedContent.length > 0) {
  finalMessage = `${userMessage}\n\n${extractedContent.join('\n\n')}\n\n[Please acknowledge and analyze the content above.]`;
}

// Return complete data structure
return {
  // Pass through all webhook data
  headers: inputJson.headers,
  params: inputJson.params,
  query: inputJson.query,
  webhookUrl: inputJson.webhookUrl,
  executionMode: inputJson.executionMode,
  
  // Flatten body to top level
  message: userMessage,
  sessionId: sessionId,
  profile: body.profile,
  
  // CRITICAL: AI Agent needs this
  chatInput: finalMessage,
  
  // Voice settings
  voice: body.voice,
  voiceId: body.voiceId,
  voiceName: body.voiceName,
  selectedVoice: body.selectedVoice,
  enableTTS: body.enableTTS,
  ttsSummaryLength: body.ttsSummaryLength,
  ttsSummarize: body.ttsSummarize,
  voiceConfig: body.voiceConfig,
  
  // User data
  userProfile: body.userProfile,
  userContext: body.userContext,
  user: body.user,
  
  // Attachment info
  attachments: attachments,
  hasAttachments: attachments.length > 0,
  extractedContent: extractedContent.join('\n\n')
};