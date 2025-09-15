// HANDLE ELEVENLABS HTTP RESPONSE
// Use this if you're using HTTP Request node to call ElevenLabs API

const input = $input.first();

console.log('[Handle ElevenLabs HTTP] Input type:', typeof input);
console.log('[Handle ElevenLabs HTTP] Input keys:', input.json ? Object.keys(input.json) : 'binary data');

// Initialize audio data
let audioData = null;

// Check if we have binary data from HTTP Request
if (input.binary && input.binary.data) {
  // Binary response from HTTP Request node
  const binaryData = input.binary.data;
  
  // Convert binary to base64
  if (binaryData.data) {
    // It's a buffer
    audioData = binaryData.data.toString('base64');
    console.log('[Handle ElevenLabs HTTP] Converted binary buffer to base64');
  } else if (typeof binaryData === 'string') {
    // It might already be base64
    audioData = binaryData;
    console.log('[Handle ElevenLabs HTTP] Binary data is already string');
  }
} else if (input.json) {
  // JSON response (if API returns base64 directly)
  const jsonData = input.json;
  
  if (jsonData.audio_base64) {
    audioData = jsonData.audio_base64;
  } else if (jsonData.audio) {
    audioData = jsonData.audio;
  } else if (jsonData.data) {
    audioData = jsonData.data;
  }
  
  if (audioData) {
    console.log('[Handle ElevenLabs HTTP] Found audio in JSON response');
  }
} else if (typeof input === 'string') {
  // Direct string response (might be base64)
  audioData = input;
  console.log('[Handle ElevenLabs HTTP] Input is direct string');
}

// Get the Format Agent Response data
let responseData = {};
try {
  const formatItems = $items("Format Agent Response");
  if (formatItems && formatItems.length > 0) {
    responseData = formatItems[0].json;
    console.log('[Handle ElevenLabs HTTP] Got Format Agent Response data:', {
      hasResponse: !!responseData.response,
      voiceId: responseData.voiceId,
      voiceName: responseData.voiceName,
      enableTTS: responseData.enableTTS
    });
  }
} catch (e) {
  console.log('[Handle ElevenLabs HTTP] Could not get Format Agent Response data');
}

// Build output
const output = {
  // Include all response data
  ...responseData,
  
  // Add audio in multiple formats
  audioBase64: audioData,
  audioData: audioData,
  audioUrl: audioData ? `data:audio/mpeg;base64,${audioData}` : null,
  
  // Ensure we have response text
  response: responseData.response || "Audio generated",
  text: responseData.response || "Audio generated",
  
  // TTS metadata
  enableTTS: true,
  ttsEnabled: true,
  ttsProcessed: true,
  audioGenerated: !!audioData,
  audioLength: audioData ? audioData.length : 0,
  
  // Pass through other fields
  voiceId: responseData.voiceId,
  voiceName: responseData.voiceName,
  sessionId: responseData.sessionId,
  
  // Timestamp
  timestamp: new Date().toISOString()
};

console.log('[Handle ElevenLabs HTTP] Output summary:', {
  hasResponse: !!output.response,
  hasAudioBase64: !!output.audioBase64,
  audioLength: output.audioLength,
  voiceId: output.voiceId
});

if (output.audioBase64) {
  console.log('[Handle ElevenLabs HTTP] Audio preview:', 
    output.audioBase64.substring(0, 30) + '...');
}

return [output];