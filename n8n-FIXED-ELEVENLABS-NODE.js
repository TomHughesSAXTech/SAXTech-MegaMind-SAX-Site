// Fixed ElevenLabs Handler - Handles voice selection and token limits
// This handles: Voice Mapping + API Call + Binary Conversion

// Get text from either ttsText (shortened) or response
const text = $json.ttsText || $json.response || $json.text || '';
const selectedVoice = $json.selectedVoice || 'sarah';
const enableTTS = $json.enableTTS !== false;

// FIXED VOICE MAPPING - These are the CORRECT ElevenLabs voice IDs
const voiceMapping = {
  // Direct names (lowercase)
  'sarah': 'EXAVITQu4vr4xnSDxMaL',      // Sarah - Professional Female
  'daniel': 'onwK4e9ZLuTAKqWW03F9',     // Daniel - Professional Male
  'emily': 'LcfcDJNUP1GQjkzn1xUU',      // Emily - British Female
  'james': 'IKne3meq5aSn9XLyUdCD',      // James - Deep Male
  'charlotte': 'XB0fDUnXU5powFXDhCwa',  // Charlotte - Energetic Female
  
  // Capitalized versions
  'Sarah': 'EXAVITQu4vr4xnSDxMaL',
  'Daniel': 'onwK4e9ZLuTAKqWW03F9',
  'Emily': 'LcfcDJNUP1GQjkzn1xUU',
  'James': 'IKne3meq5aSn9XLyUdCD',
  'Charlotte': 'XB0fDUnXU5powFXDhCwa'
};

// Get voice ID - ensure we're using the correct mapping
const voiceKey = selectedVoice.toLowerCase();
const voiceId = voiceMapping[voiceKey] || voiceMapping['sarah'];

console.log(`Voice selection: requested="${selectedVoice}", key="${voiceKey}", id="${voiceId}"`);

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
  console.log(`Making ElevenLabs API call: voiceId=${voiceId}, textLength=${cleanText.length}`);
  
  // Make ElevenLabs API call using n8n's helpers
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': 'sk_94c95a3f46355ef03ad7cc214059cccfd2c492fc1571a2bf',
      'Content-Type': 'application/json'
    },
    body: {
      text: cleanText,
      model_id: 'eleven_turbo_v2',  // Using turbo model for faster generation
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
    timeout: 10000  // 10 second timeout
  });
  
  // Convert to base64
  const audioBase64 = Buffer.from(response).toString('base64');
  
  // Validate audio data
  if (!audioBase64 || audioBase64.length < 100) {
    throw new Error('Invalid audio data received from ElevenLabs');
  }
  
  console.log(`Audio generated successfully: ${audioBase64.length} bytes (base64)`);
  
  // Return complete response with audio
  return [{
    json: {
      ...$json,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      audioBase64: audioBase64,
      ttsEnabled: true,
      voiceUsed: selectedVoice,
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