// N8N Code Node - Add this between the Merge node and "Respond to Webhook" node
// This code properly formats the streaming response to include audio data

// Get the AI response and audio data
const aiResponse = $input.item.json.response || $input.item.json.text || '';
const audioBase64 = $input.item.json.audioBase64 || $input.item.json.audioData || null;

// Log what we received for debugging
console.log('Code node inputs:', {
    hasResponse: !!aiResponse,
    responseLength: aiResponse.length,
    hasAudio: !!audioBase64,
    audioLength: audioBase64 ? audioBase64.length : 0,
    audioFirstChars: audioBase64 ? audioBase64.substring(0, 100) : 'none'
});

// Format for streaming NDJSON response
const streamingMessages = [];

// Add the begin message
streamingMessages.push({
    type: "begin",
    metadata: {
        nodeId: "audio-formatter",
        nodeName: "Audio Formatter",
        timestamp: Date.now()
    }
});

// Add the content message
streamingMessages.push({
    type: "item",
    content: aiResponse,
    metadata: {
        nodeId: "audio-formatter",
        nodeName: "Audio Formatter",
        itemIndex: 0,
        timestamp: Date.now()
    }
});

// Add the end message WITH audio data
const endMessage = {
    type: "end",
    metadata: {
        nodeId: "audio-formatter",
        nodeName: "Audio Formatter",
        itemIndex: 0,
        runIndex: 0,
        timestamp: Date.now()
    }
};

// Include audio in the end message if available
if (audioBase64) {
    endMessage.audioBase64 = audioBase64;
    // Also add in multiple places for better compatibility
    endMessage.audioData = audioBase64;
    endMessage.metadata.audioBase64 = audioBase64;
    console.log('✅ Audio included in end message, length:', audioBase64.length);
} else {
    console.log('⚠️ No audio data to include in response');
}

streamingMessages.push(endMessage);

// Convert to NDJSON format (newline-delimited JSON)
const ndjsonOutput = streamingMessages.map(msg => JSON.stringify(msg)).join('\n');

// Return formatted output
return {
    json: {
        streamingResponse: ndjsonOutput,
        response: aiResponse,
        audioBase64: audioBase64,
        format: 'ndjson'
    }
};