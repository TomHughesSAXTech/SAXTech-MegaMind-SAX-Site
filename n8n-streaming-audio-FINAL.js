// N8N Code Node - STREAMING WITH AUDIO SUPPORT
// Replace your "Respond to Webhook" node with this Code node
// This properly formats streaming NDJSON with audio included

// Get inputs from the Merge node
const aiResponse = $input.item.json.response || $input.item.json.text || '';
const audioBase64 = $input.item.json.audioBase64 || $input.item.json.audioData || $input.item.json.audio || null;

// Log what we received
console.log('=== STREAMING WITH AUDIO CODE NODE ===');
console.log('AI Response Length:', aiResponse.length);
console.log('Audio Data Present:', !!audioBase64);
if (audioBase64) {
    console.log('Audio Data Length:', audioBase64.length);
    console.log('Audio First 50 chars:', audioBase64.substring(0, 50));
}

// Build NDJSON streaming format
const messages = [];

// 1. Begin message
messages.push(JSON.stringify({
    type: "begin",
    metadata: {
        nodeId: "streaming-audio-formatter",
        nodeName: "Streaming Audio Formatter",
        timestamp: Date.now()
    }
}));

// 2. Content message(s)
// Split content into chunks for streaming effect (optional)
const chunkSize = 500; // Characters per chunk
if (aiResponse.length > chunkSize) {
    for (let i = 0; i < aiResponse.length; i += chunkSize) {
        const chunk = aiResponse.substring(i, Math.min(i + chunkSize, aiResponse.length));
        messages.push(JSON.stringify({
            type: "item",
            content: chunk,
            metadata: {
                nodeId: "streaming-audio-formatter",
                nodeName: "Streaming Audio Formatter",
                itemIndex: Math.floor(i / chunkSize),
                timestamp: Date.now()
            }
        }));
    }
} else {
    // Send as single message if short
    messages.push(JSON.stringify({
        type: "item",
        content: aiResponse,
        metadata: {
            nodeId: "streaming-audio-formatter",
            nodeName: "Streaming Audio Formatter",
            itemIndex: 0,
            timestamp: Date.now()
        }
    }));
}

// 3. End message WITH AUDIO
const endMessage = {
    type: "end",
    metadata: {
        nodeId: "streaming-audio-formatter",
        nodeName: "Streaming Audio Formatter",
        itemIndex: 0,
        runIndex: 0,
        timestamp: Date.now()
    }
};

// ADD AUDIO IN MULTIPLE PLACES FOR COMPATIBILITY
if (audioBase64) {
    // Add at root level
    endMessage.audioBase64 = audioBase64;
    endMessage.audioData = audioBase64;
    endMessage.audio = audioBase64;
    
    // Also add in metadata
    endMessage.metadata.audioBase64 = audioBase64;
    endMessage.metadata.audioData = audioBase64;
    
    console.log('✅ Audio included in streaming end message');
} else {
    console.log('⚠️ No audio data available for streaming');
}

messages.push(JSON.stringify(endMessage));

// Join with newlines for NDJSON format
const ndjsonResponse = messages.join('\n');

console.log('=== STREAMING OUTPUT ===');
console.log('Total messages:', messages.length);
console.log('Output length:', ndjsonResponse.length);
console.log('Has audio in end:', !!endMessage.audioBase64);

// Return the streaming response
// IMPORTANT: Set the response directly, not wrapped in JSON
return {
    json: {
        // This will be sent as the raw response body
        $response: ndjsonResponse,
        // Set headers for streaming
        $headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Transfer-Encoding': 'chunked'
        }
    }
};