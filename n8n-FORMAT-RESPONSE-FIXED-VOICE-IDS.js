// Format Agent Response - FIXED to handle direct voice IDs from frontend
// Get the agent output from the previous node
const agentOutput = $json;

// Get the original input data that was passed through Build Context & Route
// This contains the voice settings from the webhook request
const originalInput = $input.all()[0].json;

// CRITICAL FIX: Frontend now sends direct ElevenLabs voice IDs, not simple names
// Check multiple fields where the voice ID might be stored
const voiceId = originalInput.voice || 
                originalInput.voiceId || 
                originalInput.selectedVoice || 
                'EXAVITQu4vr4xnSDxMaL'; // Rachel as default

const voiceName = originalInput.voiceName || 'Rachel';
const isPreview = originalInput.preview === true;
const enableTTS = originalInput.enableTTS !== false;
const sessionId = originalInput.sessionId || 'default';

// Debug logging to see what we're receiving
console.log('Format Agent Response - Voice data received:', {
    voice: originalInput.voice,
    voiceId: originalInput.voiceId, 
    selectedVoice: originalInput.selectedVoice,
    voiceName: originalInput.voiceName,
    finalVoiceId: voiceId
});

// Handle preview mode - return simple preview text
if (isPreview) {
  return [{
    json: {
      response: "Hi, I'm MegaMind, your SAX AI Assistant",
      ttsText: "Hi, I'm MegaMind, your SAX AI Assistant",
      voice: voiceId,  // Pass through all voice fields
      voiceId: voiceId,
      selectedVoice: voiceId,
      voiceName: voiceName,
      enableTTS: true,
      skipTTS: false,
      sessionId: sessionId,
      preview: true,
      timestamp: new Date().toISOString(),
      metadata: {
        agentType: 'SAXTech MegaMind Voice Preview'
      }
    }
  }];
}

// Normal processing - extract the actual response from agent
let response = '';
let webhookData = {};

// Extract text from agent output based on various possible structures
if (agentOutput.output) {
  response = agentOutput.output;
  webhookData = agentOutput;
} else if (agentOutput.webhookData && agentOutput.webhookData.output) {
  response = agentOutput.webhookData.output;
  webhookData = agentOutput.webhookData;
} else if (agentOutput.text) {
  response = agentOutput.text;
  webhookData = { output: response };
} else if (agentOutput.result) {
  response = agentOutput.result;
  webhookData = { output: response };
} else if (typeof agentOutput === 'string') {
  response = agentOutput;
  webhookData = { output: response };
} else {
  response = 'I apologize, but I was unable to generate a proper response. Please try again.';
  webhookData = { output: response };
}

// Clean up the response text (remove any leftover HTML if present)
let ttsText = response;
if (ttsText.includes('<')) {
  // Strip HTML tags for TTS
  ttsText = ttsText.replace(/<[^>]*>/g, '');
}

// Handle TTS text summarization if needed
let skipTTS = false;
if (enableTTS && ttsText.length > 500) {
  // For long responses, create a shorter TTS summary
  const sentences = ttsText.match(/[^.!?]+[.!?]+/g) || [ttsText];
  
  if (sentences.length > 3) {
    // Take first 2 sentences and add a note
    ttsText = sentences.slice(0, 2).join(' ').trim() + 
              " I've provided more details in the text response.";
  } else if (ttsText.length > 300) {
    // Find a good break point
    let cutoff = ttsText.substring(0, 200).lastIndexOf('. ');
    if (cutoff === -1) cutoff = ttsText.substring(0, 200).lastIndexOf(' ');
    if (cutoff === -1) cutoff = 200;
    
    ttsText = ttsText.substring(0, cutoff).trim() + 
              "... Please see the full response for more details.";
  }
} else if (!enableTTS) {
  skipTTS = true;
  ttsText = '';
}

// Build proper response structure with all necessary voice fields
return [{
  json: {
    response: response,
    ttsText: ttsText,
    
    // CRITICAL: Pass through ALL voice fields for ElevenLabs node
    voice: voiceId,           // Primary field
    voiceId: voiceId,         // Alternative field  
    selectedVoice: voiceId,   // Legacy field
    voiceName: voiceName,     // Display name
    
    enableTTS: enableTTS,
    skipTTS: skipTTS,
    webhookData: webhookData,
    processingInfo: {
      voiceUsed: voiceName,
      voiceIdUsed: voiceId,
      ttsEnabled: enableTTS,
      ttsSummaryApplied: ttsText !== response && enableTTS,
      isPreview: false
    },
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    metadata: {
      agentType: 'SAXTech MegaMind SAX Assistant',
      responseLength: response.length,
      ttsLength: ttsText.length,
      voiceConfigured: voiceId
    }
  }
}];