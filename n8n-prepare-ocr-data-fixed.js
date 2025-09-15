// FIXED Prepare OCR Data - Handles all attachment types and preserves message
const items = $input.all();
const outputItems = [];

for (const item of items) {
  // Extract data from webhook - THE MESSAGE IS IN body.message
  const webhookBody = item.json.body || item.json;
  const sessionId = webhookBody.sessionId || 'no-session-id';
  const message = webhookBody.message || webhookBody.chatInput || '';
  const chatInput = webhookBody.chatInput || webhookBody.message || '';
  const userMessage = webhookBody.userMessage || webhookBody.message || '';
  const attachments = webhookBody.attachments || [];
  const hasAttachments = attachments.length > 0;
  const previousContext = webhookBody.previousContext || {};
  
  // Store the complete original data INCLUDING THE MESSAGE
  const originalData = {
    sessionId: sessionId,
    message: message,
    chatInput: chatInput,
    userMessage: userMessage,
    userProfile: webhookBody.userProfile || null,
    userContext: webhookBody.userContext || null,
    user: webhookBody.user || null,
    previousContext: previousContext,
    profile: webhookBody.profile || 'sage',
    voice: webhookBody.voice,
    voiceId: webhookBody.voiceId,
    voiceName: webhookBody.voiceName,
    enableTTS: webhookBody.enableTTS
  };
  
  if (hasAttachments) {
    for (const attachment of attachments) {
      // Process any attachment with data
      if (attachment.data) {
        const base64Data = attachment.data.includes(',') ? 
          attachment.data.split(',')[1] : attachment.data;
        
        // Determine attachment type
        const category = attachment.category || 'other';
        const isDocument = attachment.isDocument || 
          ['pdf', 'word', 'excel', 'powerpoint', 'text'].includes(category);
        const isImage = attachment.isImage || category === 'image';
        
        outputItems.push({
          json: {
            hasAttachments: true,
            sessionId: sessionId,
            message: message,
            chatInput: chatInput,
            userMessage: userMessage,
            attachmentName: attachment.name || 'unnamed',
            attachmentType: attachment.type || 'application/octet-stream',
            attachmentCategory: category,
            isDocument: isDocument,
            isImage: isImage,
            isScreenshot: attachment.isScreenshot || false,
            originalData: originalData
          },
          binary: {
            data: {
              data: base64Data,
              mimeType: attachment.type || 'application/octet-stream',
              fileName: attachment.name || 'attachment'
            }
          }
        });
      }
    }
  } else {
    // No attachments - PASS THROUGH THE MESSAGE AND CONTEXT
    outputItems.push({
      json: {
        hasAttachments: false,
        sessionId: sessionId,
        message: message,
        chatInput: chatInput,
        userMessage: userMessage,
        originalData: originalData,
        previousContext: previousContext,
        // Pass through all other fields for the AI agent
        profile: webhookBody.profile || 'sage',
        voice: webhookBody.voice,
        voiceId: webhookBody.voiceId,
        voiceName: webhookBody.voiceName,
        enableTTS: webhookBody.enableTTS,
        userProfile: webhookBody.userProfile || {},
        userContext: webhookBody.userContext || {},
        user: webhookBody.user || {}
      }
    });
  }
}

return outputItems;