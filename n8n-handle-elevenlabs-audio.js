// HANDLE ELEVENLABS AUDIO NODE
// This processes the ElevenLabs TTS output and formats it for the webhook response

const input = $input.first().json;

console.log('[Handle ElevenLabs] Input received:', {
  hasAudio: !!input.audio,
  hasAudioBase64: !!input.audio_base64,
  hasBase64Audio: !!input.base64_audio,
  hasMp3: !!input.mp3,
  hasData: !!input.data,
  inputKeys: Object.keys(input)
});

// ElevenLabs returns audio in different formats depending on configuration
let audioData = null;

// Check various possible fields where ElevenLabs might return audio
if (input.audio_base64) {
  audioData = input.audio_base64;
  console.log('[Handle ElevenLabs] Found audio in audio_base64 field');
} else if (input.base64_audio) {
  audioData = input.base64_audio;
  console.log('[Handle ElevenLabs] Found audio in base64_audio field');
} else if (input.audio) {
  audioData = input.audio;
  console.log('[Handle ElevenLabs] Found audio in audio field');
} else if (input.mp3) {
  audioData = input.mp3;
  console.log('[Handle ElevenLabs] Found audio in mp3 field');
} else if (input.data) {
  audioData = input.data;
  console.log('[Handle ElevenLabs] Found audio in data field');
}

// If audio is a buffer or binary, convert to base64
if (audioData && typeof audioData === 'object') {
  if (audioData.data) {
    // It's a buffer object
    audioData = Buffer.from(audioData.data).toString('base64');
    console.log('[Handle ElevenLabs] Converted buffer to base64');
  } else if (Array.isArray(audioData)) {
    // It's an array of bytes
    audioData = Buffer.from(audioData).toString('base64');
    console.log('[Handle ElevenLabs] Converted byte array to base64');
  }
}

// Get the Format Agent Response data (contains text and settings)
let responseData = {};
try {
  // Try to get the Format Agent Response data
  const formatItems = $items("Format Agent Response");
  if (formatItems && formatItems.length > 0) {
    responseData = formatItems[0].json;
    console.log('[Handle ElevenLabs] Got Format Agent Response data');
  }
} catch (e) {
  console.log('[Handle ElevenLabs] Could not get Format Agent Response data');
}

// If no response data, try to get from input
if (!responseData.response) {
  responseData = {
    response: input.response || input.text || "Audio response generated",
    voiceId: input.voiceId,
    voiceName: input.voiceName,
    sessionId: input.sessionId,
    enableTTS: true,
    ttsEnabled: true
  };
}

// Build the output with audio
const output = {
  // Include all response data
  ...responseData,
  
  // Add the audio data in multiple formats for compatibility
  audioBase64: audioData,
  audioData: audioData,
  audioUrl: audioData ? `data:audio/mpeg;base64,${audioData}` : null,
  
  // Ensure response text is included
  response: responseData.response || "Audio response generated",
  text: responseData.response || "Audio response generated",
  
  // Include TTS metadata
  enableTTS: true,
  ttsEnabled: true,
  voiceId: responseData.voiceId,
  voiceName: responseData.voiceName,
  sessionId: responseData.sessionId,
  
  // Add metadata
  ttsProcessed: true,
  audioGenerated: !!audioData,
  audioLength: audioData ? audioData.length : 0,
  timestamp: new Date().toISOString()
};

console.log('[Handle ElevenLabs] Output:', {
  hasResponse: !!output.response,
  hasAudioBase64: !!output.audioBase64,
  audioLength: output.audioLength,
  voiceId: output.voiceId,
  voiceName: output.voiceName
});

// Log audio preview if present
if (output.audioBase64) {
  console.log('[Handle ElevenLabs] Audio base64 preview:', 
    output.audioBase64.substring(0, 50) + '...');
}

return [output];