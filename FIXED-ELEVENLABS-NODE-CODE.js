// ElevenLabs TTS Handler - Generates audio using selected voice
// This handles: Direct Voice IDs + API Call + Binary Conversion

// Get text from either ttsText (shortened) or response
const text = $json.ttsText || $json.response || $json.text || '';

// Get voice ID - frontend now sends the actual ElevenLabs voice ID directly
// Check multiple fields for compatibility
const voiceId = $json.voice || $json.voiceId || $json.selectedVoice || 'EXAVITQu4vr4xnSDxMaL';
const voiceName = $json.voiceName || 'Rachel';
const enableTTS = $json.enableTTS !== false;

// Log what we received
console.log('Voice received: voiceId=' + voiceId + ', voiceName=' + voiceName + ', enableTTS=' + enableTTS);
console.log('Full voice data:', {
  voice: $json.voice,
  voiceId: $json.voiceId,
  selectedVoice: $json.selectedVoice,
  voiceName: $json.voiceName
});

// Clean text - remove HTML and limit length
let cleanText = text.replace(/<[^>]*>/g, '').trim();

// Hard limit at 2500 characters to prevent token issues
// ElevenLabs charges per character, this is about 2-3 minutes of speech
if (cleanText.length > 2500) {
  cleanText = cleanText.substring(0, 2500);
  // End at sentence boundary
  const lastPeriod = cleanText.lastIndexOf('.');
  const lastQuestion = cleanText.lastIndexOf('?');
  const lastExclamation = cleanText.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > 2000) {
    cleanText = cleanText.substring(0, lastSentenceEnd + 1);
  }
}

// If TTS disabled or no text, pass through without audio
if (!enableTTS || !cleanText || cleanText.length < 5) {
  console.log('TTS skipped: enableTTS=' + enableTTS + ', textLength=' + cleanText.length);
  return [{
    json: {
      ...$json,
      audioUrl: null,
      audioBase64: null,
      ttsEnabled: false,
      ttsSkipReason: !enableTTS ? 'disabled' : 'no_text'
    }
  }];
}

try {
  console.log('Making ElevenLabs API call: voiceId=' + voiceId + ', textLength=' + cleanText.length);
  
  // Make ElevenLabs API call using n8n's helpers
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': 'sk_94c95a3f46355ef03ad7cc214059cccfd2c492fc1571a2bf',
      'Content-Type': 'application/json'
    },
    body: {
      text: cleanText,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: false
      }
    },
    json: true,
    encoding: 'arraybuffer',
    returnFullResponse: false,
    timeout: 10000
  });
  
  // Convert to base64
  const audioBase64 = Buffer.from(response).toString('base64');
  
  // Validate audio data
  if (!audioBase64 || audioBase64.length < 100) {
    throw new Error('Invalid audio data received from ElevenLabs');
  }
  
  console.log('Audio generated successfully: ' + audioBase64.length + ' bytes (base64)');
  console.log('Voice used: ' + voiceName + ' (ID: ' + voiceId + ')');
  
  // Return complete response with audio
  return [{
    json: {
      ...$json,
      audioUrl: 'data:audio/mpeg;base64,' + audioBase64,
      audioBase64: audioBase64,
      ttsEnabled: true,
      voiceUsed: voiceName,
      voiceId: voiceId,
      textLength: cleanText.length,
      audioGenerated: true,
      timestamp: new Date().toISOString()
    }
  }];
  
} catch (error) {
  console.error('ElevenLabs TTS Error:', error.message);
  
  // Check if it's a quota/token error
  const isQuotaError = error.message && (
    error.message.includes('quota') || 
    error.message.includes('limit') || 
    error.message.includes('insufficient') ||
    error.message.includes('429') ||
    error.message.includes('402')
  );
  
  // Pass through without audio on error - DON'T STOP THE WORKFLOW
  return [{
    json: {
      ...$json,
      audioUrl: null,
      audioBase64: null,
      ttsEnabled: false,
      ttsError: error.message,
      ttsErrorType: isQuotaError ? 'quota_exceeded' : 'api_error',
      // Still return the text response even if TTS fails
      response: $json.response
    }
  }];
}