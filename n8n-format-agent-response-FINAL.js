// FORMAT AGENT RESPONSE - FINAL COMPLETE VERSION
// Handles TTS settings, session management, voice selection, and response formatting

const agentOutput = $json;
const allWorkflowItems = $items();
const allInputs = $input.all();

// Initialize all variables
let voiceId = 'gWf6X7X75oO2lF1dH79K'; // Default Tom
let voiceName = 'Tom';
let sessionId = null;
let enableTTS = false;
let originalMessage = '';

// Search through ALL workflow items to find original webhook data
for (const item of allWorkflowItems) {
  if (!item.json) continue;
  
  // Find TTS setting from voiceSettings (webhook data)
  if (item.json.voiceSettings?.ttsEnabled !== undefined) {
    enableTTS = item.json.voiceSettings.ttsEnabled;
  }
  
  // Find voice settings from voiceSettings
  if (item.json.voiceSettings?.selectedVoice) {
    voiceId = item.json.voiceSettings.selectedVoice;
    voiceName = item.json.voiceSettings.voiceName || 'Tom';
  }
  
  // Find sessionId
  if (!sessionId && item.json.sessionId && item.json.sessionId !== 'default') {
    sessionId = item.json.sessionId;
  }
  
  // Find original message
  if (!originalMessage) {
    originalMessage = item.json.MESSAGE_SENT || item.json.message || item.json.chatInput || item.json.userMessage || '';
  }
}

// Generate sessionId if not found
sessionId = sessionId || `session_${Date.now()}`;

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
      enableTTS: true,
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
let response = agentOutput.output || agentOutput.text || agentOutput.result || agentOutput.response || 
               'I apologize, but I was unable to generate a proper response.';

// Process TTS text
let ttsText = response;
let ttsSummaryApplied = false;

if (enableTTS) {
  const plainText = response.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (plainText.length > 300) {
    const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
    ttsText = sentences[0] || plainText.substring(0, 250);
    if (sentences[1] && (ttsText.length + sentences[1].length) < 250) {
      ttsText += ' ' + sentences[1];
    }
    if (sentences.length > 2) {
      ttsText += ' Additional details are displayed on your screen.';
    }
    ttsSummaryApplied = true;
  }
  
  ttsText = ttsText.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').replace(/\[|\]/g, '').replace(/\s+([.,!?])/g, '$1');
}

// Return complete formatted response
return [{
  json: {
    response: response,
    ttsText: ttsText,
    sessionId: sessionId,
    selectedVoice: voiceId,
    voiceId: voiceId,
    voiceName: voiceName,
    voice: voiceId,
    enableTTS: enableTTS,
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
        voiceSource: voiceName,
        sessionSource: sessionId.includes('session_') ? 'found/generated' : 'unknown',
        ttsSummary: ttsSummaryApplied,
        ttsEnabled: enableTTS,
        originalMessage: originalMessage
      }
    }
  }
}];