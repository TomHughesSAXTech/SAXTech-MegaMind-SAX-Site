// FINAL WEBHOOK RESPONSE MERGE - COMPLETE FIX
// Place this in a Code node right BEFORE "Respond to Webhook"
// This properly finds and merges the agent response with TTS data

const allInputs = $input.all();
console.log('[Webhook Merge FIX] Processing inputs:', allInputs.length);
console.log('[Webhook Merge FIX] Input keys:', allInputs.map(i => Object.keys(i.json || {})));

// Initialize variables
let agentResponse = null;
let ttsData = null;

// CRITICAL: Try to get Format Agent Response node output directly
try {
  if ($node && $node["Format Agent Response"]) {
    const formatNode = $node["Format Agent Response"];
    if (formatNode.json) {
      agentResponse = formatNode.json;
      console.log('[Webhook Merge FIX] Got Format Agent Response directly:', {
        hasResponse: !!agentResponse.response,
        sessionId: agentResponse.sessionId,
        voice: agentResponse.voiceId
      });
    }
  }
} catch (e) {
  console.log('[Webhook Merge FIX] Could not access Format Agent Response node directly');
}

// Search through all workflow items
const allWorkflowItems = $items();
console.log('[Webhook Merge FIX] Total workflow items:', allWorkflowItems.length);

for (let i = 0; i < allWorkflowItems.length; i++) {
  const item = allWorkflowItems[i];
  if (!item.json) continue;
  
  // Look for the formatted agent response
  // It will have: response (HTML div), sessionId, voiceId, and metadata
  if (item.json.response && 
      item.json.response.includes('<div>') && 
      item.json.sessionId && 
      item.json.sessionId.startsWith('session_') &&
      item.json.voiceId) {
    agentResponse = item.json;
    console.log(`[Webhook Merge FIX] Found agent response at item ${i}:`, {
      responsePreview: agentResponse.response.substring(0, 50),
      sessionId: agentResponse.sessionId,
      voice: agentResponse.voiceId
    });
  }
  
  // Look for TTS data
  if (item.json.hasOwnProperty('audioUrl') || 
      item.json.hasOwnProperty('audioBase64') ||
      item.json.hasOwnProperty('ttsSkipReason')) {
    ttsData = item.json;
    console.log(`[Webhook Merge FIX] Found TTS data at item ${i}`);
  }
}

// Also check direct inputs (from Merge node)
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json;
  if (!input) continue;
  
  // Check if this input has the agent response
  if (!agentResponse && input.response && input.sessionId) {
    // But make sure it's not the TTS-only data
    if (!input.ttsSkipReason) {
      agentResponse = input;
      console.log(`[Webhook Merge FIX] Found agent response in input ${i}`);
    }
  }
  
  // Check if this is TTS data
  if (input.hasOwnProperty('ttsSkipReason') || 
      input.hasOwnProperty('audioUrl') || 
      input.hasOwnProperty('audioBase64')) {
    ttsData = input;
    console.log(`[Webhook Merge FIX] Found TTS data in input ${i}`);
  }
}

// Try to find in previous nodes by looking for specific patterns
if (!agentResponse) {
  for (const item of allWorkflowItems) {
    if (!item.json) continue;
    
    // Look for the OpenAI response pattern
    if (item.json.output && typeof item.json.output === 'string') {
      // This might be the raw AI agent output
      console.log('[Webhook Merge FIX] Found potential AI output');
    }
    
    // Look for formatted response with all required fields
    if (item.json.response && item.json.ttsText && item.json.sessionId && item.json.metadata) {
      agentResponse = item.json;
      console.log('[Webhook Merge FIX] Found complete formatted response');
      break;
    }
  }
}

// Debug: Log what we found
console.log('[Webhook Merge FIX] Search results:', {
  foundAgentResponse: !!agentResponse,
  foundTTSData: !!ttsData,
  agentResponseKeys: agentResponse ? Object.keys(agentResponse).slice(0, 5) : 'none',
  ttsDataKeys: ttsData ? Object.keys(ttsData) : 'none'
});

// If we still don't have a response, this is a critical error
if (!agentResponse || !agentResponse.response) {
  console.log('[Webhook Merge FIX] ERROR: No agent response found!');
  console.log('[Webhook Merge FIX] Available items:', allWorkflowItems.map(item => {
    if (item.json && item.json.response) {
      return {
        hasResponse: true,
        responseLength: item.json.response.length,
        sessionId: item.json.sessionId
      };
    }
    return null;
  }).filter(Boolean));
  
  // Use fallback
  agentResponse = {
    response: "I apologize, but I'm having trouble processing your request. Please try again.",
    sessionId: `session_${Date.now()}`,
    voiceId: 'gWf6X7X75oO2lF1dH79K',
    voiceName: 'Tom',
    metadata: { error: 'No agent response found in workflow' }
  };
}

// Build the complete response object
const finalResponse = {
  // CRITICAL: Include the actual response text
  response: agentResponse.response,
  text: agentResponse.response || agentResponse.text,
  message: agentResponse.response,
  html: agentResponse.response,
  
  // Session management
  sessionId: agentResponse.sessionId || `session_${Date.now()}`,
  
  // Voice settings
  selectedVoice: agentResponse.selectedVoice || agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  voiceId: agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  voiceName: agentResponse.voiceName || 'Tom',
  voice: agentResponse.voice || agentResponse.voiceId || 'gWf6X7X75oO2lF1dH79K',
  
  // TTS data
  enableTTS: agentResponse.enableTTS || false,
  ttsEnabled: agentResponse.ttsEnabled || false,
  audioUrl: ttsData?.audioUrl || null,
  audioBase64: ttsData?.audioBase64 || null,
  audioData: ttsData?.audioBase64 || null,
  ttsSkipReason: ttsData?.ttsSkipReason || null,
  ttsSummaryApplied: agentResponse.ttsSummaryApplied || false,
  ttsText: agentResponse.ttsText || agentResponse.response,
  
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
      responseLength: agentResponse.response?.length || 0,
      hasTTSData: !!ttsData,
      sessionId: agentResponse.sessionId,
      voice: agentResponse.voiceId || 'not_found',
      searchedItems: allWorkflowItems.length
    }
  }
};

console.log('[Webhook Merge FIX] Final response:', {
  hasResponse: !!finalResponse.response,
  responsePreview: finalResponse.response?.substring(0, 50),
  sessionId: finalResponse.sessionId,
  voice: finalResponse.voiceId,
  ttsEnabled: finalResponse.ttsEnabled
});

// Return the complete merged response
return [finalResponse];