// FORMAT AGENT RESPONSE - TTS FIX
// This properly reads TTS settings from the original webhook request

const agentOutput = $json;

// Initialize variables
let voiceId = null;
let voiceName = null;
let sessionId = null;
let enableTTS = null; // Start as null to detect if we found it
let originalMessage = '';

// Get ALL workflow items to find the original webhook data
const allWorkflowItems = $items();
const allInputs = $input.all();

console.log('=== FORMAT AGENT RESPONSE TTS FIX ===');

// CRITICAL: Look for the ORIGINAL webhook data that has the actual TTS setting
for (const item of allWorkflowItems) {
  if (!item.json) continue;
  
  // Look for the webhook data (will have voiceSettings)
  if (item.json.voiceSettings && enableTTS === null) {
    enableTTS = item.json.voiceSettings.ttsEnabled;
    console.log('Found TTS setting from voiceSettings:', enableTTS);
  }
  
  // Check direct TTS fields
  if (enableTTS === null && item.json.ttsEnabled !== undefined) {
    enableTTS = item.json.ttsEnabled;
    console.log('Found TTS setting from ttsEnabled field:', enableTTS);
  }
  
  // Get sessionId
  if (!sessionId && item.json.sessionId && item.json.sessionId !== 'default') {
    sessionId = item.json.sessionId;
  }
  
  // Get voice settings
  if (!voiceId) {
    if (item.json.voice === 'gWf6X7X75oO2lF1dH79K' || 
        item.json.voiceId === 'gWf6X7X75oO2lF1dH79K' || 
        item.json.selectedVoice === 'gWf6X7X75oO2lF1dH79K') {
      voiceId = 'gWf6X7X75oO2lF1dH79K';
      voiceName = 'Tom';
    } else if (item.json.voiceSettings?.selectedVoice === 'gWf6X7X75oO2lF1dH79K') {
      voiceId = 'gWf6X7X75oO2lF1dH79K';
      voiceName = 'Tom';
    }
  }
  
  // Get original message
  if (!originalMessage && (item.json.message || item.json.chatInput || item.json.userMessage)) {
    originalMessage = item.json.message || item.json.chatInput || item.json.userMessage;
  }
}

// Final defaults
if (enableTTS === null) {
  enableTTS = false; // Default to false if not specified
  console.log('TTS setting not found, defaulting to false');
}
sessionId = sessionId || `session_${Date.now()}`;
voiceId = voiceId || 'gWf6X7X75oO2lF1dH79K';
voiceName = voiceName || 'Tom';

console.log('=== FINAL TTS SETTINGS ===');
console.log('Enable TTS:', enableTTS);
console.log('Session ID:', sessionId);
console.log('Voice:', voiceId, voiceName);

// Check for preview mode
const isPreview = allInputs[0]?.json?.preview === true;

if (isPreview) {
  return [{
    json: {
      response: "Hi, I'm MegaMind, your SAX AI Assistant",
      ttsText: "Hi, I'm MegaMind, your SAX AI Assistant",
      sessionId: sessionId,
      selectedVoice: voiceId,
      voiceId: voiceId,
      voiceName: voiceName,
      voice: voiceId,
      enableTTS: true, // Always enable for preview
      ttsEnabled: true,
      preview: true,
      timestamp: new Date().toISOString(),
      metadata: {
        agentType: 'SAXTech MegaMind Voice Preview',
        voiceConfigured: voiceId,
        sessionIdUsed: sessionId
      }
    }
  }];
}

// Get the actual response
let response;
if (typeof agentOutput.output === 'string') {
  response = agentOutput.output;
} else if (typeof agentOutput.text === 'string') {
  response = agentOutput.text;
} else if (typeof agentOutput.result === 'string') {
  response = agentOutput.result;
} else if (typeof agentOutput.response === 'string') {
  response = agentOutput.response;
} else {
  response = 'I apologize, but I was unable to generate a proper response.';
}

// TTS text processing
let ttsText = response;
let ttsSummaryApplied = false;

if (enableTTS) {
  const plainText = response.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Smart summarization for long responses
  if (plainText.length > 300) {
    const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
    if (sentences.length > 0) {
      ttsText = sentences[0];
      if (sentences[1] && (ttsText.length + sentences[1].length) < 250) {
        ttsText += ' ' + sentences[1];
      }
      if (sentences.length > 2) {
        ttsText += ' Additional details are displayed on your screen.';
      }
      ttsSummaryApplied = true;
    }
  }
  
  // Clean up
  ttsText = ttsText
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\[|\]/g, '')
    .replace(/\s+([.,!?])/g, '$1');
}

// Return formatted response with CORRECT TTS setting
return [{
  json: {
    response: response,
    ttsText: ttsText,
    sessionId: sessionId,
    selectedVoice: voiceId,
    voiceId: voiceId,
    voiceName: voiceName,
    voice: voiceId,
    enableTTS: enableTTS, // Use the actual setting from request
    ttsEnabled: enableTTS,
    ttsSummaryApplied: ttsSummaryApplied,
    preview: false,
    timestamp: new Date().toISOString(),
    originalMessage: originalMessage,
    metadata: {
      agentType: 'SAXTech MegaMind SAX Assistant',
      responseLength: response.length,
      ttsLength: ttsText.length,
      voiceConfigured: voiceId,
      voiceNameConfigured: voiceName,
      sessionIdUsed: sessionId,
      debugInfo: {
        inputsChecked: allInputs.length,
        workflowItemsChecked: allWorkflowItems.length,
        voiceSource: voiceId === 'gWf6X7X75oO2lF1dH79K' ? 'Tom (user)' : 'other',
        sessionSource: sessionId.includes('session_') ? 'found/generated' : 'unknown',
        ttsSummary: ttsSummaryApplied,
        ttsSettingSource: enableTTS !== null ? 'found' : 'default',
        ttsEnabled: enableTTS,
        originalMessage: originalMessage
      }
    }
  }
}];