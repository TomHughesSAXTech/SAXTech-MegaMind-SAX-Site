// WEBHOOK RESPONSE DEBUG - Use this to debug what's being sent back
// Place this in the Code node right before "Respond to Webhook"

const inputData = $input.all();
console.log('[WEBHOOK DEBUG] ============================================');
console.log('[WEBHOOK DEBUG] Number of inputs:', inputData.length);

// Log each input in detail
for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i].json || inputData[i];
  console.log(`[WEBHOOK DEBUG] Input ${i}:`, {
    keys: Object.keys(item),
    hasResponse: !!item.response,
    responseLength: item.response?.length || 0,
    hasAudioBase64: !!item.audioBase64,
    audioBase64Length: item.audioBase64?.length || 0,
    hasAudioData: !!item.audioData,
    audioDataLength: item.audioData?.length || 0,
    hasAudioUrl: !!item.audioUrl,
    audioUrlLength: item.audioUrl?.length || 0,
    enableTTS: item.enableTTS,
    ttsEnabled: item.ttsEnabled,
    voiceId: item.voiceId,
    voiceName: item.voiceName,
    sessionId: item.sessionId
  });
  
  // If we have audio, log first 100 chars
  if (item.audioBase64) {
    console.log('[WEBHOOK DEBUG] audioBase64 preview:', item.audioBase64.substring(0, 100) + '...');
  }
  if (item.audioData) {
    console.log('[WEBHOOK DEBUG] audioData preview:', item.audioData.substring(0, 100) + '...');
  }
  if (item.audioUrl) {
    console.log('[WEBHOOK DEBUG] audioUrl preview:', item.audioUrl.substring(0, 100) + '...');
  }
}

// Process the response
const output = [];

for (const item of inputData) {
  // Get response text
  let aiResponse = item.response || item.text || item.output || item.message || 
                   "I'm ready to help. Please send me your message.";
  
  // Build response object with ALL audio fields
  const responseObject = {
    // Main response
    response: aiResponse,
    text: aiResponse,
    message: aiResponse,
    
    // Session
    sessionId: item.sessionId || `session_${Date.now()}`,
    
    // AUDIO FIELDS - Include everything
    audioBase64: item.audioBase64 || item.audioData || null,
    audioData: item.audioBase64 || item.audioData || null,
    audioUrl: item.audioUrl || null,
    audio: item.audio || null,
    ttsAudio: item.ttsAudio || null,
    
    // TTS Settings
    enableTTS: item.enableTTS || item.ttsEnabled || false,
    ttsEnabled: item.enableTTS || item.ttsEnabled || false,
    voiceId: item.voiceId || item.voice || null,
    voiceName: item.voiceName || null,
    voice: item.voice || item.selectedVoice || null,
    ttsSkipReason: item.ttsSkipReason || null,
    
    // Other data
    visionAnalysis: item.visionAnalysis || null,
    extractedText: item.extractedText || null,
    metadata: item.metadata || {},
    
    // Status
    success: true,
    status: 'success',
    timestamp: new Date().toISOString()
  };
  
  console.log('[WEBHOOK DEBUG] Final response object:', {
    hasResponse: !!responseObject.response,
    responseLength: responseObject.response.length,
    hasAudioBase64: !!responseObject.audioBase64,
    audioBase64Length: responseObject.audioBase64?.length || 0,
    hasAudioData: !!responseObject.audioData,
    audioDataLength: responseObject.audioData?.length || 0,
    hasAudioUrl: !!responseObject.audioUrl,
    enableTTS: responseObject.enableTTS,
    voiceId: responseObject.voiceId
  });
  
  output.push(responseObject);
}

// Fallback if no input
if (output.length === 0) {
  console.log('[WEBHOOK DEBUG] No input data, creating fallback response');
  output.push({
    response: "I'm ready to help. Please send me your message.",
    text: "I'm ready to help. Please send me your message.",
    sessionId: `session_${Date.now()}`,
    success: false,
    status: 'no_input',
    timestamp: new Date().toISOString()
  });
}

console.log('[WEBHOOK DEBUG] ============================================');
return output;