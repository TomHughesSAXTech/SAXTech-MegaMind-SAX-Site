// WEBHOOK PASSTHROUGH WITH AUDIO
// Place this right before "Respond to Webhook" to ensure audio is passed through
// This is a simple passthrough that preserves everything

const input = $input.first().json;

console.log('[Webhook Passthrough] Input received:', {
  hasResponse: !!input.response,
  hasAudioBase64: !!input.audioBase64,
  hasAudioData: !!input.audioData,
  hasAudioUrl: !!input.audioUrl,
  audioBase64Length: input.audioBase64?.length || 0,
  enableTTS: input.enableTTS,
  voiceId: input.voiceId
});

// Pass through EVERYTHING, ensuring audio fields are included
const output = {
  // Preserve all existing fields
  ...input,
  
  // Ensure response fields exist
  response: input.response || input.text || "Response generated",
  text: input.response || input.text || "Response generated",
  
  // CRITICAL: Ensure audio fields are passed through
  audioBase64: input.audioBase64 || input.audioData || null,
  audioData: input.audioBase64 || input.audioData || null,
  audioUrl: input.audioUrl || null,
  
  // Preserve TTS settings
  enableTTS: input.enableTTS || input.ttsEnabled || false,
  ttsEnabled: input.enableTTS || input.ttsEnabled || false,
  voiceId: input.voiceId || null,
  voiceName: input.voiceName || null,
  
  // Add timestamp if not present
  timestamp: input.timestamp || new Date().toISOString()
};

console.log('[Webhook Passthrough] Output being sent:', {
  hasResponse: !!output.response,
  responseLength: output.response?.length || 0,
  hasAudioBase64: !!output.audioBase64,
  audioBase64Length: output.audioBase64?.length || 0,
  hasAudioData: !!output.audioData,
  hasAudioUrl: !!output.audioUrl,
  enableTTS: output.enableTTS,
  voiceId: output.voiceId
});

// If we have audio, log a preview
if (output.audioBase64) {
  console.log('[Webhook Passthrough] Audio detected, first 50 chars:', 
    output.audioBase64.substring(0, 50) + '...');
}

return [output];