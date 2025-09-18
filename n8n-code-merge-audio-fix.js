// N8N CODE NODE: Merge AI Response with Audio for Streaming
// Put this in the Code node that comes AFTER the Merge node and BEFORE Streaming Format node
// This ensures audio data is properly passed through to the streaming response

const items = $input.all();
console.log('[Code Merge] Total inputs:', items.length);

// Initialize output with all fields
let output = {
  // Text response fields
  response: '',
  text: '',
  htmlResponse: '',
  hasHtml: false,
  
  // TTS configuration
  enableTTS: false,
  ttsEnabled: false,
  voiceId: null,
  voiceName: null,
  
  // CRITICAL: Audio data fields
  audioUrl: null,
  audioBase64: null,
  audioData: null,
  audioGenerated: false,
  
  // Session and metadata
  sessionId: null,
  userProfile: {},
  metadata: {}
};

// Process ALL inputs to extract data
for (let i = 0; i < items.length; i++) {
  const item = items[i].json || items[i];
  console.log(`[Code Merge] Input ${i} keys:`, Object.keys(item).slice(0, 20));
  
  // Extract text response fields
  if (item.response) output.response = item.response;
  if (item.text) output.text = item.text;
  if (item.htmlResponse) output.htmlResponse = item.htmlResponse;
  if (item.hasHtml !== undefined) output.hasHtml = item.hasHtml;
  
  // Extract TTS configuration
  if (item.enableTTS !== undefined) output.enableTTS = item.enableTTS;
  if (item.ttsEnabled !== undefined) output.ttsEnabled = item.ttsEnabled;
  if (item.voiceId) output.voiceId = item.voiceId;
  if (item.voiceName) output.voiceName = item.voiceName;
  
  // CRITICAL SECTION: Extract ALL audio data fields
  // Check multiple field names because different nodes might use different names
  if (item.audioUrl) {
    output.audioUrl = item.audioUrl;
    console.log('[Code Merge] Found audioUrl, length:', item.audioUrl.length);
    
    // If it's a data URL, extract base64
    if (item.audioUrl.startsWith('data:audio/')) {
      const base64Part = item.audioUrl.split(',')[1];
      if (base64Part) {
        output.audioBase64 = base64Part;
        output.audioData = base64Part;
      }
    }
  }
  
  if (item.audioBase64) {
    output.audioBase64 = item.audioBase64;
    output.audioData = item.audioBase64; // Duplicate for compatibility
    console.log('[Code Merge] Found audioBase64, length:', item.audioBase64.length);
    
    // Create data URL if missing
    if (!output.audioUrl) {
      output.audioUrl = `data:audio/mpeg;base64,${item.audioBase64}`;
    }
  }
  
  if (item.audioData && !output.audioData) {
    output.audioData = item.audioData;
    output.audioBase64 = item.audioData; // Duplicate for compatibility
    console.log('[Code Merge] Found audioData, length:', item.audioData.length);
    
    // Create data URL if missing
    if (!output.audioUrl) {
      output.audioUrl = `data:audio/mpeg;base64,${item.audioData}`;
    }
  }
  
  // Check for audio generation flag
  if (item.audioGenerated !== undefined) {
    output.audioGenerated = item.audioGenerated;
  }
  
  // Extract session and metadata
  if (item.sessionId) output.sessionId = item.sessionId;
  if (item.userProfile) output.userProfile = { ...output.userProfile, ...item.userProfile };
  if (item.metadata) output.metadata = { ...output.metadata, ...item.metadata };
}

// Set audio flags if ANY audio data exists
if (output.audioUrl || output.audioBase64 || output.audioData) {
  output.audioGenerated = true;
  console.log('[Code Merge] Audio data is present, setting audioGenerated to true');
  
  // Log audio data presence for debugging
  console.log('[Code Merge] Audio status:', {
    hasAudioUrl: !!output.audioUrl,
    audioUrlLength: output.audioUrl ? output.audioUrl.length : 0,
    hasAudioBase64: !!output.audioBase64,
    audioBase64Length: output.audioBase64 ? output.audioBase64.length : 0,
    hasAudioData: !!output.audioData,
    audioDataLength: output.audioData ? output.audioData.length : 0
  });
}

// Ensure response fields have content
if (!output.response && output.text) {
  output.response = output.text;
}
if (!output.text && output.response) {
  output.text = output.response;
}
if (!output.htmlResponse && output.response) {
  output.htmlResponse = output.response;
}

// Add timestamp
output.timestamp = new Date().toISOString();

// Final validation log
console.log('[Code Merge] Final output summary:', {
  hasResponse: !!output.response,
  responseLength: output.response.length,
  hasAudioUrl: !!output.audioUrl,
  hasAudioBase64: !!output.audioBase64,
  hasAudioData: !!output.audioData,
  audioGenerated: output.audioGenerated,
  enableTTS: output.enableTTS,
  voiceId: output.voiceId,
  sessionId: output.sessionId
});

// Return as single item for streaming
return [{ json: output }];