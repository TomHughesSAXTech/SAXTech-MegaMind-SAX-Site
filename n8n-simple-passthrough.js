// Simple Passthrough for n8n - Preserves webhook data
// Use this in "Prepare Context and Route" node (the one BEFORE AI Agent)

const inputJson = $input.first().json;
const body = inputJson.body || inputJson;

// Debug what we received
console.log('=== WEBHOOK DATA RECEIVED ===');
console.log('Has body:', !!inputJson.body);
console.log('Body keys:', inputJson.body ? Object.keys(inputJson.body) : 'No body');
console.log('Attachments in body:', inputJson.body?.attachments?.length || 0);

// Get the message and attachments from body
const userMessage = body.message || '';
const attachments = body.attachments || [];
const sessionId = body.sessionId || `session_${Date.now()}`;

// Build a message that includes attachment info for now
let messageForAI = userMessage;

if (attachments.length > 0) {
  messageForAI += `\n\n[User attached ${attachments.length} file(s):]`;
  attachments.forEach((att, i) => {
    messageForAI += `\n${i+1}. ${att.name || 'unnamed'} (${att.type || 'unknown type'})`;
    if (att.isScreenshot) {
      messageForAI += ' [Screenshot]';
    }
  });
  messageForAI += '\n\n[Note: File content extraction is not yet implemented. Please acknowledge the files were received.]';
}

// Return everything, preserving the structure
return {
  // Keep all webhook data
  ...inputJson,
  
  // Override with body contents (flattened)
  ...body,
  
  // CRITICAL: This is what AI Agent needs
  chatInput: messageForAI,
  
  // Preserve these explicitly
  message: userMessage,
  sessionId: sessionId,
  attachments: attachments,
  
  // Voice settings from body
  voice: body.voice,
  voiceId: body.voiceId,
  voiceName: body.voiceName,
  selectedVoice: body.selectedVoice,
  enableTTS: body.enableTTS,
  
  // User profile
  userProfile: body.userProfile,
  userContext: body.userContext,
  
  // Debug info
  _debug: {
    webhookHadBody: !!inputJson.body,
    attachmentCount: attachments.length,
    messageLength: userMessage.length
  }
};