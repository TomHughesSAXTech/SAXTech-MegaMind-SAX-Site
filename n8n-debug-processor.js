// Debug version - Shows what's happening with attachments
// Use this temporarily in "Copy Pasta Screenshots and Attachments" to diagnose

const inputJson = $input.first().json;
const body = inputJson.body || inputJson;

// Get the message
const userMessage = body.message || body.MESSAGE_SENT || '';
const sessionId = body.sessionId || inputJson.sessionId || `session_${Date.now()}`;

// Get attachments array
const attachments = body.attachments || [];

// Debug: Log what we received
console.log('=== ATTACHMENT DEBUG ===');
console.log('Number of attachments:', attachments.length);
console.log('User message:', userMessage);

// Build debug info
let debugInfo = [];
debugInfo.push(`Received ${attachments.length} attachment(s)`);

for (let i = 0; i < attachments.length; i++) {
  const att = attachments[i];
  debugInfo.push(`\nAttachment ${i + 1}:`);
  debugInfo.push(`- Name: ${att.name || 'unknown'}`);
  debugInfo.push(`- Type: ${att.type || 'unknown'}`);
  debugInfo.push(`- Is Screenshot: ${att.isScreenshot || false}`);
  debugInfo.push(`- Has Data: ${att.data ? 'YES' : 'NO'}`);
  if (att.data) {
    debugInfo.push(`- Data starts with: ${att.data.substring(0, 50)}...`);
    // Check if it's a valid data URL
    const isDataUrl = att.data.startsWith('data:');
    debugInfo.push(`- Is valid data URL: ${isDataUrl}`);
    if (isDataUrl) {
      const base64Match = att.data.match(/^data:([^;]+);base64,(.+)$/);
      debugInfo.push(`- Has base64 content: ${base64Match ? 'YES' : 'NO'}`);
    }
  }
}

// Create a message that includes debug info for the AI
const debugMessage = userMessage + '\n\n' + 
  '=== ATTACHMENT PROCESSING DEBUG ===\n' + 
  debugInfo.join('\n') + '\n' +
  '=== END DEBUG ===\n\n' +
  'Note: This is debug output. The actual content extraction is not running.';

// Return everything with debug info
return {
  ...inputJson,
  ...body,
  
  // For AI Agent
  chatInput: debugMessage,
  
  // Keep all other fields
  MESSAGE_SENT: userMessage,
  sessionId: sessionId,
  
  // Voice settings
  voice: body.voice,
  voiceId: body.voiceId,
  voiceName: body.voiceName,
  selectedVoice: body.selectedVoice,
  enableTTS: body.enableTTS,
  
  // Debug output
  _debug: {
    attachmentCount: attachments.length,
    hasAttachments: attachments.length > 0,
    attachmentInfo: debugInfo,
    messageReceived: userMessage
  }
};