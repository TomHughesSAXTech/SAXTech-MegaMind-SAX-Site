// Updated ElevenLabs Handler with proper voice IDs and text summarization
// This node: Maps voices correctly + Summarizes text + Handles API efficiently

// Get input data
const text = $json.ttsText || $json.response || $json.text || '';
const selectedVoice = $json.selectedVoice || 'rachel';
const enableTTS = $json.enableTTS !== false;
const ttsSummarize = $json.ttsSummarize !== false;  // Default to true

// DYNAMIC VOICE MAPPING - Build from incoming voice configuration
// The frontend sends voiceConfig with the voice mappings from admin
const voiceConfig = $json.voiceConfig || [];
const voiceMapping = {};

// Build mapping from config
if (voiceConfig.length > 0) {
  voiceConfig.forEach(voice => {
    if (!voice || !voice.name) return;
    const key = String(voice.name).toLowerCase();
    const vid = voice.id || voice.voiceId || voice.voice_id || voice.voiceID || voice.value || null;
    if (vid) {
      voiceMapping[key] = vid;
    }
  });
  console.log('Using dynamic voice configuration:', Object.keys(voiceMapping).length, 'voices');
} else {
  // Fallback to default mapping if no config provided
  Object.assign(voiceMapping, {
    'rachel': 'EXAVITQu4vr4xnSDxMaL',
    'clyde': 'onwK4e9ZLuTAKqWW03F9',
    'charlotte': 'XB0fDUnXU5powFXDhCwa',
    'bill': 'pqHfZKP75CvOlQylNhV4',
    'george': 'JBFqnCBsd6RMkjVDRZzb',
    'domi': 'AZnzlk1XvdvUeBnXmlld',
    'nicole': 'piTKgcLEGmPE4e6mEKli',
    'jessie': 'Zlb1dXrM653N07WRdFW3'
  });
  console.log('Using default voice mapping');
}

// Get voice ID
const voiceKey = String(selectedVoice || '').toLowerCase();
const isLikelyId = /^[A-Za-z0-9_-]{10,}$/.test(selectedVoice || '');
let voiceId = isLikelyId ? selectedVoice : (voiceMapping[voiceKey] || voiceMapping['rachel']);

console.log(`Voice selection: requested="${selectedVoice}", key="${voiceKey}", id="${voiceId}"`);

// Clean and prepare text
let cleanText = text.replace(/<[^>]*>/g, '').trim();

// SUMMARIZATION LOGIC - Reduce tokens for TTS
if (ttsSummarize && cleanText.length > 500) {
  console.log(`Original text length: ${cleanText.length} characters`);
  
  // Extract key sentences for TTS summary
  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  let summary = '';
  
  // Strategy 1: Take first and last sentences
  if (sentences.length > 2) {
    const firstSentence = sentences[0].trim();
    const lastSentence = sentences[sentences.length - 1].trim();
    
    // Look for key phrases that indicate important information
    const keyPhrases = [
      'important', 'key', 'summary', 'total', 'result', 'conclusion',
      'therefore', 'however', 'but', 'specifically', 'note that',
      'please', 'must', 'should', 'required', 'need'
    ];
    
    // Find sentences with key phrases
    const importantSentences = sentences.filter(s => 
      keyPhrases.some(phrase => s.toLowerCase().includes(phrase))
    ).slice(0, 3);  // Max 3 important sentences
    
    // Build summary
    summary = firstSentence;
    
    // Add important sentences if they're different from first/last
    importantSentences.forEach(s => {
      if (!summary.includes(s.trim()) && summary.length + s.length < 400) {
        summary += ' ' + s.trim();
      }
    });
    
    // Add last sentence if different and space allows
    if (!summary.includes(lastSentence) && summary.length + lastSentence.length < 500) {
      summary += ' ' + lastSentence;
    }
    
  } else {
    // Short text, use as is but truncate if needed
    summary = sentences.join(' ');
  }
  
  // Hard limit at 500 characters for TTS (about 30-45 seconds of speech)
  if (summary.length > 500) {
    summary = summary.substring(0, 497) + '...';
  }
  
  cleanText = summary;
  console.log(`Summarized to: ${cleanText.length} characters`);
}

// Additional hard limit at 1000 characters to prevent token waste
// Even without summarization, we don't want to read novels
if (cleanText.length > 1000) {
  cleanText = cleanText.substring(0, 997) + '...';
  console.log(`Text truncated to 1000 characters to save tokens`);
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
      ttsSkipReason: !enableTTS ? 'disabled' : 'no_text',
      ttsSummaryApplied: false
    }
  }];
}

try {
  console.log(`Making ElevenLabs API call: voiceId=${voiceId}, textLength=${cleanText.length}`);
  
  // Make ElevenLabs API call
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': 'sk_94c95a3f46355ef03ad7cc214059cccfd2c492fc1571a2bf',  // Your API key
      'Content-Type': 'application/json'
    },
    body: {
      text: cleanText,
      model_id: 'eleven_turbo_v2_5',  // Latest turbo model for better quality
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,  // Set to 0 for more consistent voice
        use_speaker_boost: true  // Enable for better clarity
      }
    },
    json: true,
    encoding: 'arraybuffer',
    returnFullResponse: false,
    timeout: 15000  // 15 second timeout
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
      originalTextLength: text.length,
      ttsSummaryApplied: ttsSummarize && text.length > 500,
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
    error.message.includes('402') ||
    error.message.includes('monthly character limit')
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
      quotaMessage: isQuotaError ? 'Monthly character limit reached. TTS disabled for this response.' : null,
      // Still return the text response even if TTS fails
      response: $json.response
    }
  }];
}