// =====================================
// FORMAT AGENT RESPONSE - ULTIMATE FIX
// This comprehensively extracts TTS settings from all possible sources
// =====================================

// Get all inputs to search for necessary data
const allInputs = $input.all();
console.log('[Format Agent Response] Total inputs:', allInputs.length);

// Initialize variables with defaults
let agentResponse = '';
let enableTTS = false;
let selectedVoice = 'sarah';
let voiceId = '';
let sessionId = '';
let isPreview = false;
let userProfile = {};
let ttsSummaryLength = 'normal';

// Step 1: Search through ALL inputs for the data we need
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json || allInputs[i];
  
  // Log what we're looking at
  console.log(`[Format Agent Response] Input ${i}:`, {
    hasResponse: !!input.response || !!input.text || !!input.output,
    hasEnableTTS: input.enableTTS !== undefined,
    hasTTSEnabled: input.ttsEnabled !== undefined,
    hasVoice: !!input.voice,
    hasSelectedVoice: !!input.selectedVoice,
    hasVoiceId: !!input.voiceId,
    hasSessionId: !!input.sessionId,
    hasPreview: !!input.preview,
    keys: Object.keys(input).slice(0, 10)
  });
  
  // Extract agent response (from AI Agent node)
  if (!agentResponse) {
    if (input.response && typeof input.response === 'string') {
      agentResponse = input.response;
    } else if (input.text && typeof input.text === 'string') {
      agentResponse = input.text;
    } else if (input.output && typeof input.output === 'string') {
      agentResponse = input.output;
    } else if (input.result && typeof input.result === 'string') {
      agentResponse = input.result;
    }
  }
  
  // Extract TTS settings (from webhook or context)
  if (input.enableTTS !== undefined) {
    enableTTS = input.enableTTS === true;
  } else if (input.ttsEnabled !== undefined) {
    enableTTS = input.ttsEnabled === true;
  }
  
  // Extract voice selection
  if (input.selectedVoice) {
    selectedVoice = input.selectedVoice;
  } else if (input.voice) {
    selectedVoice = input.voice;
  }
  
  // Extract voice ID if already mapped
  if (input.voiceId) {
    voiceId = input.voiceId;
  }
  
  // Extract session ID
  if (input.sessionId) {
    sessionId = input.sessionId;
  }
  
  // Check for preview mode
  if (input.preview === true) {
    isPreview = true;
  }
  
  // Extract user profile
  if (input.userProfile) {
    userProfile = input.userProfile;
  }
  
  // Extract TTS summary length
  if (input.ttsSummaryLength) {
    ttsSummaryLength = input.ttsSummaryLength;
  }
}

// Step 2: Try to get from specific nodes if we're missing data
if (!enableTTS && !selectedVoice) {
  try {
    // Try Webhook node
    const webhookNode = $('Webhook');
    if (webhookNode && webhookNode.first()) {
      const webhookData = webhookNode.first().json;
      console.log('[Format Agent Response] Found Webhook node data:', {
        enableTTS: webhookData.enableTTS,
        voice: webhookData.voice || webhookData.selectedVoice
      });
      
      if (webhookData.enableTTS !== undefined) {
        enableTTS = webhookData.enableTTS === true;
      }
      if (webhookData.selectedVoice || webhookData.voice) {
        selectedVoice = webhookData.selectedVoice || webhookData.voice;
      }
      if (webhookData.sessionId) {
        sessionId = webhookData.sessionId;
      }
      if (webhookData.preview === true) {
        isPreview = true;
      }
      if (webhookData.userProfile) {
        userProfile = webhookData.userProfile;
      }
    }
  } catch (e) {
    console.log('[Format Agent Response] Could not access Webhook node:', e.message);
  }
  
  try {
    // Try Prepare Context node
    const contextNode = $('Prepare Context');
    if (contextNode && contextNode.first()) {
      const contextData = contextNode.first().json;
      console.log('[Format Agent Response] Found Prepare Context data:', {
        enableTTS: contextData.enableTTS,
        voiceId: contextData.voiceId
      });
      
      if (!enableTTS && contextData.enableTTS !== undefined) {
        enableTTS = contextData.enableTTS === true;
      }
      if (!voiceId && contextData.voiceId) {
        voiceId = contextData.voiceId;
      }
      if (!selectedVoice && contextData.selectedVoice) {
        selectedVoice = contextData.selectedVoice;
      }
    }
  } catch (e) {
    console.log('[Format Agent Response] Could not access Prepare Context node:', e.message);
  }
}

// Step 3: Voice mapping for ElevenLabs
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',
  'daniel': 'onwK4e9ZLuTAKqWW03F9',
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'james': 'N2lVS1w4EtoT3dr4eOWO',
  'charlotte': 'XB0fDUnXU5powFXDhCwa'
};

// Get the correct voice ID if not already set
if (!voiceId) {
  voiceId = voiceMap[selectedVoice.toLowerCase()] || voiceMap['sarah'];
}

// Get voice name for display
const voiceName = selectedVoice.charAt(0).toUpperCase() + selectedVoice.slice(1).toLowerCase();

// Generate session ID if missing
if (!sessionId) {
  sessionId = `session_${Date.now()}`;
}

// Step 4: Prepare the response text
let fullResponse = agentResponse;
let ttsText = agentResponse;

// Handle preview mode
if (isPreview) {
  const firstName = userProfile?.givenName || userProfile?.name?.split(' ')[0] || '';
  fullResponse = firstName 
    ? `Hello ${firstName}! I'm ready to help. What can I do for you today?`
    : "Hello! I'm ready to assist you. What can I do for you today?";
  ttsText = fullResponse;
}
// Handle no response
else if (!agentResponse || agentResponse.trim() === '') {
  fullResponse = "I'm ready to help. Please send me your message.";
  ttsText = fullResponse;
}
// Handle TTS summary for long responses
else if (enableTTS && ttsSummaryLength === 'short' && agentResponse.length > 200) {
  const sentences = agentResponse.match(/[^.!?]+[.!?]+/g) || [agentResponse];
  
  if (sentences.length > 3) {
    ttsText = sentences.slice(0, 2).join(' ').trim();
    if (ttsText.length < agentResponse.length * 0.5) {
      ttsText += " I've provided more details in the text response.";
    }
  } else if (agentResponse.length > 250) {
    let cutoff = agentResponse.substring(0, 200).lastIndexOf('. ');
    if (cutoff === -1) cutoff = 200;
    ttsText = agentResponse.substring(0, cutoff).trim() + "... See the full response in text.";
  }
}

// Step 5: Log the final configuration
console.log('[Format Agent Response] FINAL CONFIG:', {
  enableTTS: enableTTS,
  selectedVoice: selectedVoice,
  voiceId: voiceId,
  voiceName: voiceName,
  sessionId: sessionId,
  isPreview: isPreview,
  responseLength: fullResponse.length,
  ttsTextLength: ttsText.length
});

// Step 6: Return the properly formatted response
return [{
  json: {
    // Text responses
    response: fullResponse,
    text: fullResponse,
    ttsText: enableTTS ? ttsText : '',
    
    // Voice configuration - CRITICAL: Include all variations
    voiceId: voiceId,
    voice: selectedVoice,
    selectedVoice: selectedVoice,
    voiceName: voiceName,
    
    // TTS control flags - CRITICAL: These control whether TTS runs
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
      voiceConfigured: voiceId,
      ttsConfigured: enableTTS,
      responseType: isPreview ? 'preview' : 'normal',
      ttsSummaryApplied: ttsText.length < fullResponse.length
    }
  }
}];