// FINAL WEBHOOK RESPONSE MERGE FIX
// Place this in a Code node right BEFORE "Respond to Webhook"
// This merges the agent response with TTS data properly

const allInputs = $input.all();
console.log('[Webhook Merge] Processing inputs:', allInputs.length);

// Find the agent response and TTS data
let agentResponse = null;
let ttsData = null;
let formatAgentData = null;

// Search through all workflow items to find the complete data
const allWorkflowItems = $items();

for (const item of allWorkflowItems) {
  if (!item.json) continue;
  
  // Look for the formatted agent response (has response text + sessionId + voice)
  if (item.json.response && item.json.sessionId && item.json.voiceId) {
    formatAgentData = item.json;
    console.log('[Webhook Merge] Found formatted agent response');
  }
  
  // Look for TTS data
  if (item.json.audioUrl !== undefined || item.json.audioBase64 !== undefined) {
    ttsData = item.json;
    console.log('[Webhook Merge] Found TTS data');
  }
}

// Also check direct inputs
for (const input of allInputs) {
  if (!input.json) continue;
  
  // Check if this is the agent response
  if (input.json.response && input.json.sessionId) {
    agentResponse = input.json;
    console.log('[Webhook Merge] Found agent response in input');
  }
  
  // Check if this is TTS data
  if (input.json.audioUrl !== undefined || input.json.ttsSkipReason) {
    ttsData = input.json;
    console.log('[Webhook Merge] Found TTS data in input');
  }
}

// Use formatAgentData as primary source if available
if (formatAgentData) {
  agentResponse = formatAgentData;
}

// If we still don't have a response, create a fallback
if (!agentResponse || !agentResponse.response) {
  console.log('[Webhook Merge] WARNING: No agent response found, using fallback');
  agentResponse = {
    response: "I received your message but encountered an issue processing it. Please try again.",
    sessionId: `session_${Date.now()}`,
    voiceId: 'gWf6X7X75oO2lF1dH79K',
    voiceName: 'Tom'
  };
}

// Build the complete response object
const finalResponse = {
  // CRITICAL: Include the actual response text
  response: agentResponse.response,
  text: agentResponse.response,
  message: agentResponse.response,
  html: agentResponse.response,
  
  // Session management
  sessionId: agentResponse.sessionId || `session_${Date.now()}`,
  
  // Voice settings (from agent response)
  selectedVoice: agentResponse.selectedVoice || agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  voiceId: agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  voiceName: agentResponse.voiceName || 'Tom',
  voice: agentResponse.voice || agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  
  // TTS data (merged from TTS node if available)
  enableTTS: ttsData?.ttsEnabled || agentResponse.enableTTS || false,
  ttsEnabled: ttsData?.ttsEnabled || agentResponse.ttsEnabled || false,
  audioUrl: ttsData?.audioUrl || null,
  audioBase64: ttsData?.audioBase64 || null,
  audioData: ttsData?.audioBase64 || null,
  ttsSkipReason: ttsData?.ttsSkipReason || null,
  ttsSummaryApplied: agentResponse.ttsSummaryApplied || false,
  
  // Original data
  originalMessage: agentResponse.originalMessage || '',
  
  // Status
  success: true,
  status: 'success',
  
  // Timestamps
  timestamp: agentResponse.timestamp || new Date().toISOString(),
  
  // Metadata
  metadata: {
    ...(agentResponse.metadata || {}),
    responseReturned: true,
    ttsProcessed: !!ttsData,
    mergeApplied: true,
    debugInfo: {
      hasAgentResponse: !!agentResponse.response,
      hasTTSData: !!ttsData,
      sessionId: agentResponse.sessionId,
      voice: agentResponse.voiceId || 'not_found'
    }
  }
};

console.log('[Webhook Merge] Final response summary:', {
  hasResponse: !!finalResponse.response,
  responseLength: finalResponse.response?.length || 0,
  sessionId: finalResponse.sessionId,
  voice: finalResponse.voiceId,
  ttsEnabled: finalResponse.ttsEnabled,
  hasAudio: !!finalResponse.audioUrl || !!finalResponse.audioBase64
});

// Return the complete merged response
return [finalResponse];