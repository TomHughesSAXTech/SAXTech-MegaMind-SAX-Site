// =====================================
// N8N CODE NODE - FINAL RESPONSE COMBINE
// Place this AFTER ElevenLabs (or after IF node for non-TTS branch)
// This combines everything for the final webhook response
// =====================================

// Get the processed data from earlier nodes
const processedData = $('Code').item.json;
const elevenLabsData = $('ElevenLabs').item?.json || {};

// Extract audio data if it exists
let audioBase64 = null;
if (elevenLabsData.audio) {
  audioBase64 = elevenLabsData.audio;
} else if (elevenLabsData.audioBase64) {
  audioBase64 = elevenLabsData.audioBase64;
} else if (elevenLabsData.data) {
  audioBase64 = elevenLabsData.data;
}

// Log what we're sending back
console.log('Final Response:', {
  hasAudio: !!audioBase64,
  audioLength: audioBase64 ? audioBase64.length : 0,
  responseLength: processedData.response ? processedData.response.length : 0,
  voiceUsed: processedData.selectedVoice,
  ttsWasEnabled: processedData.enableTTS
});

// Return the complete response
return {
  // The text response to display
  response: processedData.response,
  
  // Audio data (base64 encoded)
  audioBase64: audioBase64,
  audioData: audioBase64, // Duplicate for compatibility
  
  // Voice information
  voice: processedData.selectedVoice,
  voiceUsed: processedData.selectedVoice,
  
  // Metadata
  ttsSummaryUsed: processedData.processingInfo?.ttsSummaryApplied || false,
  ttsEnabled: processedData.enableTTS,
  
  // Success flag
  success: true
};