// FIX FOR MERGE TTS RESPONSE NODE
// This properly merges Format Agent Response with TTS data (or lack thereof)
// Replace the Merge node with this Code node

const allInputs = $input.all();
console.log('[Merge TTS] Number of inputs:', allInputs.length);

// Find the Format Agent Response data
let formatAgentResponse = null;
let ttsData = null;

// Check all inputs
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json || allInputs[i];
  console.log(`[Merge TTS] Input ${i} keys:`, Object.keys(input).slice(0, 10));
  
  // Format Agent Response will have: response, sessionId, voiceId, metadata
  if (input.response && input.sessionId && input.voiceId) {
    formatAgentResponse = input;
    console.log('[Merge TTS] Found Format Agent Response at input', i);
  }
  
  // TTS data will have: audioUrl, audioBase64, or ttsSkipReason
  if (input.hasOwnProperty('audioUrl') || 
      input.hasOwnProperty('audioBase64') || 
      input.hasOwnProperty('ttsSkipReason')) {
    ttsData = input;
    console.log('[Merge TTS] Found TTS data at input', i);
  }
}

// If we didn't find Format Agent Response in inputs, look in workflow items
if (!formatAgentResponse) {
  console.log('[Merge TTS] Looking for Format Agent Response in workflow items...');
  
  // Try to get it directly from the node
  try {
    if ($node && $node["Format Agent Response"]) {
      const formatNode = $node["Format Agent Response"];
      if (formatNode.json && formatNode.json.response) {
        formatAgentResponse = formatNode.json;
        console.log('[Merge TTS] Got Format Agent Response from node directly');
      }
    }
  } catch (e) {
    console.log('[Merge TTS] Could not access Format Agent Response node directly');
  }
  
  // Search through all workflow items
  if (!formatAgentResponse) {
    const allItems = $items();
    for (const item of allItems) {
      if (item.json && item.json.response && item.json.sessionId && item.json.voiceId) {
        formatAgentResponse = item.json;
        console.log('[Merge TTS] Found Format Agent Response in workflow items');
        break;
      }
    }
  }
}

// If still no Format Agent Response, this is an error
if (!formatAgentResponse) {
  console.log('[Merge TTS] ERROR: No Format Agent Response found!');
  // Return what we have
  return [{
    json: {
      error: 'No Format Agent Response found',
      enableTTS: false,
      ...allInputs[0]?.json
    }
  }];
}

// Merge the data
const mergedResponse = {
  // PRESERVE ALL Format Agent Response data
  ...formatAgentResponse,
  
  // Add/override with TTS data if available
  audioUrl: ttsData?.audioUrl || null,
  audioBase64: ttsData?.audioBase64 || null,
  audioData: ttsData?.audioBase64 || null,
  ttsSkipReason: ttsData?.ttsSkipReason || null,
  
  // Ensure TTS status is correct
  enableTTS: formatAgentResponse.enableTTS || false,
  ttsEnabled: formatAgentResponse.ttsEnabled || false,
  
  // Keep the response data
  response: formatAgentResponse.response,
  text: formatAgentResponse.response,
  sessionId: formatAgentResponse.sessionId,
  voiceId: formatAgentResponse.voiceId,
  voiceName: formatAgentResponse.voiceName,
  
  // Update metadata
  metadata: {
    ...formatAgentResponse.metadata,
    ttsProcessed: !!ttsData,
    mergeCompleted: true
  }
};

console.log('[Merge TTS] Merged response summary:', {
  hasResponse: !!mergedResponse.response,
  responseLength: mergedResponse.response?.length || 0,
  sessionId: mergedResponse.sessionId,
  voice: mergedResponse.voiceId,
  ttsEnabled: mergedResponse.ttsEnabled,
  hasAudio: !!mergedResponse.audioUrl || !!mergedResponse.audioBase64
});

return [mergedResponse];