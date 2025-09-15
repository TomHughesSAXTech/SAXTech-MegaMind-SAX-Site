// FORMAT AGENT RESPONSE - MERGE AI OUTPUT WITH TTS SETTINGS
// This node merges the AI Agent output with the TTS settings from Simple Memory Input

const allInputs = $input.all();
console.log('[Format Agent Response] Number of inputs:', allInputs.length);

// Initialize variables
let aiOutput = '';
let ttsSettings = {};
let contextData = {};

// Search through inputs to find AI output and TTS settings
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json || allInputs[i];
  
  console.log(`[Format Agent Response] Input ${i}:`, {
    hasOutput: !!input.output,
    hasResponse: !!input.response,
    hasEnableTTS: input.enableTTS !== undefined,
    hasVoiceId: !!input.voiceId,
    hasSessionId: !!input.sessionId,
    keys: Object.keys(input).slice(0, 15)
  });
  
  // Look for AI Agent output (usually has 'output' field)
  if (input.output && typeof input.output === 'string') {
    aiOutput = input.output;
    console.log('[Format Agent Response] Found AI output at input', i);
  } else if (input.response && typeof input.response === 'string') {
    aiOutput = input.response;
    console.log('[Format Agent Response] Found AI response at input', i);
  } else if (input.text && typeof input.text === 'string') {
    aiOutput = input.text;
    console.log('[Format Agent Response] Found AI text at input', i);
  }
  
  // Look for TTS settings (from Simple Memory Input or Prepare Context)
  if (input.enableTTS !== undefined || input.voiceId || input.sessionId) {
    // Merge TTS settings (don't overwrite with undefined values)
    if (input.enableTTS !== undefined) ttsSettings.enableTTS = input.enableTTS;
    if (input.ttsEnabled !== undefined) ttsSettings.ttsEnabled = input.ttsEnabled;
    if (input.voice) ttsSettings.voice = input.voice;
    if (input.selectedVoice) ttsSettings.selectedVoice = input.selectedVoice;
    if (input.voiceId) ttsSettings.voiceId = input.voiceId;
    if (input.voiceName) ttsSettings.voiceName = input.voiceName;
    if (input.sessionId) ttsSettings.sessionId = input.sessionId;
    if (input.ttsSummaryLength) ttsSettings.ttsSummaryLength = input.ttsSummaryLength;
    if (input.preview !== undefined) ttsSettings.preview = input.preview;
    if (input.userProfile) ttsSettings.userProfile = input.userProfile;
    
    console.log('[Format Agent Response] Found TTS settings at input', i, {
      enableTTS: ttsSettings.enableTTS,
      voiceId: ttsSettings.voiceId,
      voiceName: ttsSettings.voiceName
    });
  }
}

// If we didn't find AI output, use a default
if (!aiOutput || aiOutput.trim() === '') {
  aiOutput = "I'm ready to help. How can I assist you today?";
  console.log('[Format Agent Response] No AI output found, using default');
}

// Extract final settings with defaults
const enableTTS = ttsSettings.enableTTS === true || ttsSettings.ttsEnabled === true;
const selectedVoice = ttsSettings.selectedVoice || ttsSettings.voice || 'sarah';
const voiceId = ttsSettings.voiceId || '';
const voiceName = ttsSettings.voiceName || '';
const sessionId = ttsSettings.sessionId || `session_${Date.now()}`;
const ttsSummaryLength = ttsSettings.ttsSummaryLength || 'normal';
const isPreview = ttsSettings.preview === true;
const userProfile = ttsSettings.userProfile || {};

// Voice mapping if voiceId is not set but voice name is
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',
  'daniel': 'onwK4e9ZLuTAKqWW03F9',
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'james': 'N2lVS1w4EtoT3dr4eOWO',
  'charlotte': 'XB0fDUnXU5powFXDhCwa'
};

// If voiceId is not set but we have a voice name, try to map it
let finalVoiceId = voiceId;
if (!finalVoiceId && selectedVoice) {
  // Check if it's already a voice ID (long string)
  if (selectedVoice.length > 10) {
    finalVoiceId = selectedVoice;
  } else {
    // Map from name
    finalVoiceId = voiceMap[selectedVoice.toLowerCase()] || voiceMap['sarah'];
  }
}

// Get display name for voice
let finalVoiceName = voiceName;
if (!finalVoiceName) {
  if (selectedVoice && selectedVoice.length <= 10) {
    finalVoiceName = selectedVoice.charAt(0).toUpperCase() + selectedVoice.slice(1).toLowerCase();
  } else {
    finalVoiceName = 'Custom Voice';
  }
}

// Prepare TTS text
let fullResponse = aiOutput;
let ttsText = aiOutput;

// Handle preview mode
if (isPreview) {
  const firstName = userProfile?.givenName || userProfile?.name?.split(' ')[0] || '';
  fullResponse = firstName 
    ? `Hello ${firstName}! I'm ready to help. What can I do for you today?`
    : "Hello! I'm ready to assist you. What can I do for you today?";
  ttsText = fullResponse;
}
// Handle TTS summary for long responses
else if (enableTTS && ttsSummaryLength === 'short' && aiOutput.length > 200) {
  const sentences = aiOutput.match(/[^.!?]+[.!?]+/g) || [aiOutput];
  
  if (sentences.length > 3) {
    ttsText = sentences.slice(0, 2).join(' ').trim();
    if (ttsText.length < aiOutput.length * 0.5) {
      ttsText += " I've provided more details in the text response.";
    }
  } else if (aiOutput.length > 250) {
    let cutoff = aiOutput.substring(0, 200).lastIndexOf('. ');
    if (cutoff === -1) cutoff = 200;
    ttsText = aiOutput.substring(0, cutoff).trim() + "... See the full response in text.";
  }
}

console.log('[Format Agent Response] FINAL OUTPUT:', {
  responseLength: fullResponse.length,
  ttsTextLength: ttsText.length,
  enableTTS: enableTTS,
  voiceId: finalVoiceId,
  voiceName: finalVoiceName,
  sessionId: sessionId,
  isPreview: isPreview
});

// Return formatted response
return [{
  json: {
    // Text responses
    response: fullResponse,
    text: fullResponse,
    ttsText: enableTTS ? ttsText : '',
    
    // Voice configuration - ALL fields for compatibility
    voiceId: finalVoiceId,
    voice: selectedVoice,
    selectedVoice: selectedVoice,
    voiceName: finalVoiceName,
    
    // TTS control flags
    enableTTS: enableTTS,
    ttsEnabled: enableTTS,
    skipTTS: !enableTTS || !ttsText,
    
    // Session management
    sessionId: sessionId,
    
    // Preview flag
    preview: isPreview,
    
    // User profile
    userProfile: userProfile,
    
    // Metadata
    metadata: {
      source: 'Format Agent Response',
      timestamp: new Date().toISOString(),
      voiceConfigured: finalVoiceId,
      voiceNameConfigured: finalVoiceName,
      ttsConfigured: enableTTS,
      responseType: isPreview ? 'preview' : 'normal',
      ttsSummaryApplied: ttsText.length < fullResponse.length,
      inputsProcessed: allInputs.length
    }
  }
}];