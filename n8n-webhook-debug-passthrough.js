// WEBHOOK DEBUG AND PASSTHROUGH
// Place this right after your Webhook node to see what's being received
// and ensure all data is properly passed through

const input = $json;
const headers = $input.item.json.headers || {};
const query = $input.item.json.query || {};

console.log('=== WEBHOOK DATA RECEIVED ===');
console.log('Input keys:', Object.keys(input));
console.log('Headers:', headers);
console.log('Query params:', query);

// Log specific important fields
if (input.voiceSettings) {
  console.log('Voice Settings:', {
    ttsEnabled: input.voiceSettings.ttsEnabled,
    selectedVoice: input.voiceSettings.selectedVoice,
    voiceName: input.voiceSettings.voiceName
  });
}

console.log('Message:', input.message || input.chatInput || input.userMessage);
console.log('Session ID:', input.sessionId);
console.log('Has attachments:', input.hasAttachments);

// CRITICAL: Ensure TTS setting is at root level for downstream nodes
const ttsEnabled = input.voiceSettings?.ttsEnabled || input.ttsEnabled || false;

// Pass through ALL data with TTS setting at root level
const output = {
  ...input,  // Keep everything from webhook
  
  // Ensure these critical fields are at root level
  ttsEnabled: ttsEnabled,
  enableTTS: ttsEnabled,
  
  // Ensure message is available in multiple fields
  message: input.message || input.chatInput || input.userMessage || input.MESSAGE_SENT || '',
  chatInput: input.chatInput || input.message || input.userMessage || input.MESSAGE_SENT || '',
  userMessage: input.userMessage || input.message || input.chatInput || input.MESSAGE_SENT || '',
  
  // Ensure session ID is available
  sessionId: input.sessionId || `session_${Date.now()}`,
  
  // Keep voice settings both nested and at root
  voiceSettings: input.voiceSettings,
  selectedVoice: input.voiceSettings?.selectedVoice || input.selectedVoice || 'gWf6X7X75oO2lF1dH79K',
  voiceId: input.voiceSettings?.voiceId || input.voiceId || 'gWf6X7X75oO2lF1dH79K',
  voiceName: input.voiceSettings?.voiceName || input.voiceName || 'Tom',
  
  // Debug info
  _webhookDebug: {
    originalTtsEnabled: input.voiceSettings?.ttsEnabled,
    finalTtsEnabled: ttsEnabled,
    hasVoiceSettings: !!input.voiceSettings,
    messageFound: !!(input.message || input.chatInput || input.userMessage || input.MESSAGE_SENT)
  }
};

console.log('=== OUTPUT TO NEXT NODE ===');
console.log('TTS Enabled:', output.ttsEnabled);
console.log('Message:', output.message);
console.log('Session ID:', output.sessionId);

return [output];