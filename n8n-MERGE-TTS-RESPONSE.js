// =====================================
// MERGE TTS RESPONSE CODE NODE
// This combines the response with audio (if generated)
// =====================================

// Get the formatted response data
const formattedData = $('Format Agent Response Code').first().json;

// Try to get audio data from ElevenLabs (might not exist if TTS was skipped)
let audioBase64 = null;
try {
  const elevenLabsData = $('Handle ElevenLabs Audio').first().json;
  
  // ElevenLabs might return audio in different fields
  if (elevenLabsData) {
    if (elevenLabsData.audio) {
      audioBase64 = elevenLabsData.audio;
    } else if (elevenLabsData.audioBase64) {
      audioBase64 = elevenLabsData.audioBase64;
    } else if (elevenLabsData.data) {
      audioBase64 = elevenLabsData.data;
    } else if (elevenLabsData.base64) {
      audioBase64 = elevenLabsData.base64;
    }
  }
} catch (e) {
  // No audio data available (TTS was skipped)
  console.log('No TTS audio generated (TTS disabled or skipped)');
}

// Log the final response details
console.log('Merge TTS Response:', {
  hasAudio: !!audioBase64,
  audioLength: audioBase64 ? audioBase64.length : 0,
  responseLength: formattedData.response ? formattedData.response.length : 0,
  voiceUsed: formattedData.selectedVoice,
  ttsWasEnabled: formattedData.enableTTS,
  textWasTruncated: formattedData.processingInfo?.textWasTruncated || false
});

// Build the final response
const finalResponse = {
  // The text response to display in chat
  response: formattedData.response || '',
  
  // Audio data (if TTS was generated)
  audioBase64: audioBase64,
  audioData: audioBase64,  // Duplicate for compatibility
  
  // Voice information
  voice: formattedData.selectedVoice || 'sarah',
  voiceUsed: formattedData.selectedVoice || 'sarah',
  
  // Metadata
  ttsSummaryUsed: formattedData.processingInfo?.ttsSummaryApplied || false,
  ttsEnabled: formattedData.enableTTS || false,
  
  // Success flag
  success: true,
  
  // Debug info (remove in production)
  debug: {
    audioGenerated: !!audioBase64,
    voiceSelected: formattedData.selectedVoice,
    ttsWasRequested: formattedData.enableTTS,
    textWasTruncated: formattedData.processingInfo?.textWasTruncated || false
  }
};

// Return the final response
return finalResponse;