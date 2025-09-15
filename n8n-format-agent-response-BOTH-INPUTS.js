// FORMAT AGENT RESPONSE - HANDLES BOTH SEPARATE AND MERGED INPUTS
// This version works whether inputs come separately or merged

const allInputs = $input.all();
console.log('[Format Agent Response] Total inputs received:', allInputs.length);

// Initialize variables
let aiOutput = '';
let ttsSettings = {};

// Log what we received
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json || allInputs[i];
  console.log(`[Format Agent Response] Input ${i} contains:`, {
    keys: Object.keys(input).slice(0, 10),
    hasOutput: !!input.output,
    hasResponse: !!input.response,
    hasEnableTTS: input.enableTTS !== undefined,
    enableTTSValue: input.enableTTS,
    hasVoiceId: !!input.voiceId,
    voiceIdValue: input.voiceId,
    hasSessionId: !!input.sessionId,
    sessionIdValue: input.sessionId
  });
}

// CRITICAL: Check if we only have 1 input (AI output only)
// This means the TTS settings didn't arrive at this node
if (allInputs.length === 1) {
  console.log('[Format Agent Response] WARNING: Only 1 input received. Looking for TTS settings in workflow...');
  
  // Try to get TTS settings from the Simple Memory Input node directly
  try {
    const memoryItems = $items("Simple Memory Input Fix");
    if (memoryItems && memoryItems.length > 0) {
      const memoryData = memoryItems[0].json;
      console.log('[Format Agent Response] Found Simple Memory Input data:', {
        enableTTS: memoryData.enableTTS,
        voiceId: memoryData.voiceId,
        voiceName: memoryData.voiceName
      });
      ttsSettings = memoryData;
    }
  } catch (e) {
    console.log('[Format Agent Response] Could not access Simple Memory Input node');
  }
  
  // Also try Prepare Context
  if (!ttsSettings.enableTTS) {
    try {
      const contextItems = $items("Prepare Context and Route");
      if (contextItems && contextItems.length > 0) {
        const contextData = contextItems[0].json;
        console.log('[Format Agent Response] Found Prepare Context data:', {
          enableTTS: contextData.enableTTS,
          voiceId: contextData.voiceId
        });
        ttsSettings = contextData;
      }
    } catch (e) {
      console.log('[Format Agent Response] Could not access Prepare Context node');
    }
  }
  
  // Get AI output from the single input
  const singleInput = allInputs[0].json || allInputs[0];
  aiOutput = singleInput.output || singleInput.response || singleInput.text || '';
} 
// If we have 2+ inputs, process them normally
else {
  for (const inputItem of allInputs) {
    const input = inputItem.json || inputItem;
    
    // Look for AI output
    if (input.output && typeof input.output === 'string') {
      aiOutput = input.output;
      console.log('[Format Agent Response] Found AI output');
    } else if (input.response && typeof input.response === 'string' && !input.enableTTS) {
      aiOutput = input.response;
    }
    
    // Look for TTS settings
    if (input.enableTTS !== undefined || input.voiceId || input.sessionId) {
      Object.assign(ttsSettings, {
        enableTTS: input.enableTTS,
        ttsEnabled: input.ttsEnabled,
        voice: input.voice,
        selectedVoice: input.selectedVoice,
        voiceId: input.voiceId,
        voiceName: input.voiceName,
        sessionId: input.sessionId,
        ttsSummaryLength: input.ttsSummaryLength,
        preview: input.preview,
        userProfile: input.userProfile
      });
      console.log('[Format Agent Response] Found TTS settings');
    }
  }
}

// Clean up AI output (remove HTML if present)
if (aiOutput.includes('<div>') || aiOutput.includes('<p>')) {
  aiOutput = aiOutput.replace(/<[^>]+>/g, '').trim();
}

// Set defaults if no AI output
if (!aiOutput) {
  aiOutput = "I'm ready to help. How can I assist you today?";
}

// Extract final TTS settings
const enableTTS = ttsSettings.enableTTS === true || ttsSettings.ttsEnabled === true;
const voiceId = ttsSettings.voiceId || 'EXAVITQu4vr4xnSDxMaL';
const voiceName = ttsSettings.voiceName || 'Sarah';
const selectedVoice = ttsSettings.selectedVoice || ttsSettings.voice || 'sarah';
const sessionId = ttsSettings.sessionId || `session_${Date.now()}`;
const ttsSummaryLength = ttsSettings.ttsSummaryLength || 'normal';
const isPreview = ttsSettings.preview === true;
const userProfile = ttsSettings.userProfile || {};

// Handle voice ID that's already an ID (like your Tom voice)
let finalVoiceId = voiceId;
let finalVoiceName = voiceName;

// Check if voiceId needs mapping
if (voiceId && voiceId.length > 20) {
  // It's already a voice ID
  finalVoiceId = voiceId;
  finalVoiceName = voiceName || 'Custom Voice';
} else if (selectedVoice && selectedVoice.length > 20) {
  // selectedVoice is actually an ID
  finalVoiceId = selectedVoice;
  finalVoiceName = voiceName || 'Custom Voice';
} else {
  // Map from name
  const voiceMap = {
    'sarah': 'EXAVITQu4vr4xnSDxMaL',
    'daniel': 'onwK4e9ZLuTAKqWW03F9',
    'emily': 'LcfcDJNUP1GQjkzn1xUU',
    'james': 'N2lVS1w4EtoT3dr4eOWO',
    'charlotte': 'XB0fDUnXU5powFXDhCwa'
  };
  finalVoiceId = voiceMap[selectedVoice.toLowerCase()] || voiceId;
  finalVoiceName = voiceName || selectedVoice.charAt(0).toUpperCase() + selectedVoice.slice(1);
}

// Prepare TTS text
let fullResponse = aiOutput;
let ttsText = aiOutput;

// Handle preview mode
if (isPreview) {
  const firstName = userProfile?.givenName || '';
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

// Log final output
console.log('[Format Agent Response] FINAL OUTPUT:', {
  responseLength: fullResponse.length,
  ttsTextLength: ttsText.length,
  enableTTS: enableTTS,
  voiceId: finalVoiceId,
  voiceName: finalVoiceName,
  sessionId: sessionId,
  inputsReceived: allInputs.length
});

// Return the formatted response
return [{
  json: {
    // Text responses
    response: fullResponse,
    text: fullResponse,
    ttsText: enableTTS ? ttsText : '',
    
    // Voice configuration - CRITICAL: Pass the actual voice ID
    voiceId: finalVoiceId,
    voice: selectedVoice,
    selectedVoice: selectedVoice,
    voiceName: finalVoiceName,
    
    // TTS control flags - CRITICAL: Must be true for TTS to run
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
      inputsProcessed: allInputs.length,
      ttsSettingsFrom: allInputs.length === 1 ? 'workflow-lookup' : 'direct-input'
    }
  }
}];