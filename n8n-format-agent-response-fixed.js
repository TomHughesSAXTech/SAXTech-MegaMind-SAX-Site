// FIXED FORMAT AGENT RESPONSE NODE
// This correctly extracts and uses the voice ID from the input

// Get the agent output from the previous node
const agentOutput = $json;

// Get the original input data that was passed through Prepare Context and Route
// This contains the voice data from the webhook request
const originalInput = $input.all()[0].json;

// Extract voice ID - check multiple fields to ensure we get it
const voiceId = originalInput.voiceId || 
                originalInput.selectedVoice || 
                originalInput.voice ||
                'EXAVITQu4vr4xnSDxMaL'; // Rachel as absolute fallback

const voiceName = originalInput.voiceName || 'Rachel';

const isPreview = originalInput.preview === true;
const enableTTS = originalInput.enableTTS !== false || originalInput.ttsEnabled !== false;
const sessionId = originalInput.sessionId || 'default';

// Log for debugging
console.log('=== FORMAT AGENT RESPONSE ===');
console.log('Voice ID being used:', voiceId);
console.log('Voice Name:', voiceName);
console.log('EnableTTS:', enableTTS);
console.log('Input data keys:', Object.keys(originalInput));
console.log('=============================');

// Handle preview mode - return simple preview text
if (isPreview) {
  return [{
    json: {
      response: "Hi, I'm MegaMind, your SAX AI Assistant",
      sessionId: sessionId,
      selectedVoice: voiceId,  // Use actual voice ID
      voiceId: voiceId,         // Include both fields
      voiceName: voiceName,
      voice: voiceId,           // Legacy field
      enableTTS: true,
      ttsEnabled: true,
      preview: true,
      timestamp: new Date().toISOString(),
      metadata: {
        agentType: 'SAXTech MegaMind Voice Preview',
        voiceConfigured: voiceId
      }
    }
  }];
}

// Normal processing - get the actual response
let response;
if (typeof agentOutput.output === 'string') {
  response = agentOutput.output;
} else if (typeof agentOutput.text === 'string') {
  response = agentOutput.text;
} else if (typeof agentOutput.result === 'string') {
  response = agentOutput.result;
} else {
  response = 'I apologize, but I was unable to generate a proper response.';
}

// Check if we should summarize for TTS
const MAX_TTS_LENGTH = 300;
let ttsText = response;
let ttsSummaryApplied = false;

if (enableTTS && response.length > MAX_TTS_LENGTH) {
  // Extract the first paragraph or meaningful summary
  const firstParagraph = response.match(/<p[^>]*>([^<]+)<\/p>/)?.[1] || 
                        response.replace(/<[^>]+>/g, '').substring(0, MAX_TTS_LENGTH);
  
  ttsText = firstParagraph.substring(0, MAX_TTS_LENGTH);
  if (ttsText.length === MAX_TTS_LENGTH && !ttsText.endsWith('.')) {
    const lastPeriod = ttsText.lastIndexOf('.');
    if (lastPeriod > 0) {
      ttsText = ttsText.substring(0, lastPeriod + 1);
    }
  }
  ttsSummaryApplied = true;
}

// Build proper response structure with the actual voice
return [{
  json: {
    response: response,
    ttsText: ttsText,
    sessionId: sessionId,
    // CRITICAL: Use the actual voice ID from input, not a hardcoded value
    selectedVoice: voiceId,    
    voiceId: voiceId,          
    voiceName: voiceName,      
    voice: voiceId,            // Legacy field for compatibility
    enableTTS: enableTTS,
    ttsEnabled: enableTTS,     // Include both variations
    ttsSummaryApplied: ttsSummaryApplied,
    preview: false,
    timestamp: new Date().toISOString(),
    metadata: {
      agentType: 'SAXTech MegaMind SAX Assistant',
      responseLength: response.length,
      ttsLength: ttsText.length,
      voiceConfigured: voiceId,
      voiceNameConfigured: voiceName
    }
  }
}];