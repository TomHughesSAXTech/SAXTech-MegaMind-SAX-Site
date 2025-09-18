// N8N CODE NODE: Fix Audio in NDJSON Response
// Place this BEFORE the Webhook Response node
// This ensures audio is included in the NDJSON stream

// Get the input from Format Agent Response
const input = $input.all()[0].json;

// Check if we're in streaming mode (NDJSON)
const isNDJSON = true; // Set based on your workflow logic

if (isNDJSON) {
  // For NDJSON, we need to structure the response as multiple JSON objects
  // separated by newlines
  
  const response = input.response || input.text || "Response generated";
  const audioBase64 = input.audioBase64 || input.audioData || "";
  const enableTTS = input.enableTTS || false;
  const voiceId = input.voiceId || "";
  
  // Create NDJSON lines
  const ndjsonLines = [];
  
  // Line 1: Begin message
  ndjsonLines.push(JSON.stringify({
    type: "begin",
    metadata: {
      nodeName: "MegaMind SAGE",
      timestamp: Date.now()
    }
  }));
  
  // Line 2: Content message
  ndjsonLines.push(JSON.stringify({
    type: "item",
    content: response
  }));
  
  // Line 3: End message WITH AUDIO DATA
  const endMessage = {
    type: "end",
    metadata: {
      nodeId: "26b3546e-3010-4e51-ac0d-ac3e92c270be",
      nodeName: "MegaMind SAGE",
      itemIndex: 0,
      runIndex: 0,
      timestamp: Date.now()
    }
  };
  
  // CRITICAL: Add audio fields to the end message if TTS is enabled
  if (enableTTS && audioBase64) {
    endMessage.audioBase64 = audioBase64;
    endMessage.audioData = audioBase64;
    endMessage.audioGenerated = true;
    endMessage.voiceId = voiceId;
    endMessage.voiceUsed = input.voiceName || "default";
    
    // Also add in metadata for redundancy
    endMessage.metadata.audioBase64 = audioBase64;
    endMessage.metadata.audioData = audioBase64;
    endMessage.metadata.hasAudio = true;
  }
  
  ndjsonLines.push(JSON.stringify(endMessage));
  
  // Join with newlines for NDJSON format
  const ndjsonResponse = ndjsonLines.join('\n');
  
  return [{
    json: {
      _raw: ndjsonResponse,
      _contentType: 'application/x-ndjson',
      _sendRaw: true
    }
  }];
  
} else {
  // Regular JSON response (non-streaming)
  return [{
    json: {
      response: input.response,
      text: input.text,
      audioBase64: input.audioBase64,
      audioData: input.audioData,
      audioGenerated: input.audioGenerated,
      enableTTS: input.enableTTS,
      voiceId: input.voiceId,
      voiceName: input.voiceName,
      sessionId: input.sessionId,
      metadata: input.metadata
    }
  }];
}