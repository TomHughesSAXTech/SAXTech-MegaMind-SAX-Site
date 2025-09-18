// COMPLETE STREAMING FIX WITH HTML AND AUDIO SUPPORT
// This replaces the "Streaming Format" node to properly handle HTML and audio

const input = $input.item.json;

// Extract all the data we need
const response = input.response || input.text || '';
const htmlResponse = input.htmlResponse || input.response || '';
const hasHtml = input.hasHtml || false;
const audioBase64 = input.audioBase64 || input.audioData || input.audio || null;
const audioUrl = input.audioUrl || null;
const enableTTS = input.enableTTS || false;
const sessionId = input.sessionId || '';

console.log('=== STREAMING FORMATTER ===');
console.log('Has HTML:', hasHtml);
console.log('Response length:', response.length);
console.log('HTML Response length:', htmlResponse.length);
console.log('Audio present:', !!audioBase64);
console.log('Audio URL present:', !!audioUrl);
console.log('TTS enabled:', enableTTS);

// For non-streaming (search results, employee cards, etc), return as JSON
if (hasHtml || htmlResponse.includes('<div') || htmlResponse.includes('<button')) {
  console.log('Detected HTML content - using JSON response format');
  
  const jsonResponse = {
    response: htmlResponse, // Use HTML version
    text: response,
    hasHtml: true,
    sessionId: sessionId
  };
  
  // Add audio if present
  if (audioBase64 || audioUrl) {
    jsonResponse.audioUrl = audioUrl;
    jsonResponse.audioBase64 = audioBase64;
    jsonResponse.audioData = audioBase64;
    jsonResponse.audio = audioBase64;
    jsonResponse.audioGenerated = true;
    console.log('Audio included in JSON response');
  }
  
  // Return as JSON for proper HTML rendering
  return {
    json: jsonResponse
  };
}

// For plain text responses, use streaming NDJSON format
console.log('Using streaming NDJSON format');

const messages = [];

// 1. Begin message
messages.push(JSON.stringify({
  type: "begin",
  metadata: {
    nodeId: "streaming-formatter",
    timestamp: Date.now()
  }
}));

// 2. Content chunks for streaming effect
const chunkSize = 100; // Smaller chunks for smoother streaming
const textToStream = response || htmlResponse;

if (textToStream.length > chunkSize) {
  for (let i = 0; i < textToStream.length; i += chunkSize) {
    const chunk = textToStream.substring(i, Math.min(i + chunkSize, textToStream.length));
    messages.push(JSON.stringify({
      type: "content",
      content: chunk,
      metadata: {
        nodeId: "streaming-formatter",
        itemIndex: Math.floor(i / chunkSize),
        timestamp: Date.now()
      }
    }));
  }
} else {
  // Send as single message if short
  messages.push(JSON.stringify({
    type: "content",
    content: textToStream,
    metadata: {
      nodeId: "streaming-formatter",
      itemIndex: 0,
      timestamp: Date.now()
    }
  }));
}

// 3. End message WITH AUDIO
const endMessage = {
  type: "end",
  metadata: {
    nodeId: "streaming-formatter",
    timestamp: Date.now()
  }
};

// Add audio data in multiple locations for compatibility
if (audioBase64 || audioUrl) {
  // Add at root level
  endMessage.audioBase64 = audioBase64;
  endMessage.audioData = audioBase64;
  endMessage.audio = audioBase64;
  endMessage.audioUrl = audioUrl || `data:audio/mpeg;base64,${audioBase64}`;
  
  // Also add in metadata
  endMessage.metadata.audioBase64 = audioBase64;
  endMessage.metadata.audioUrl = audioUrl;
  endMessage.metadata.hasAudio = true;
  
  console.log('✅ Audio included in streaming end message');
} else {
  console.log('⚠️ No audio data in streaming response');
}

messages.push(JSON.stringify(endMessage));

// Join with newlines for NDJSON
const ndjsonResponse = messages.join('\n');

console.log('Total messages:', messages.length);
console.log('Streaming response length:', ndjsonResponse.length);

// Return streaming response
return {
  json: {
    $response: ndjsonResponse,
    $headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  }
};