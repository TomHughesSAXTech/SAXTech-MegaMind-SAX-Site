// COMPLETE STREAMING FORMAT FIX - HANDLES HTML AND AUDIO WITH PROPER SSE FORMAT
// SOLVES: HTML not rendering, audio not playing, streaming not working
//
// HOW TO USE:
// 1. Open your n8n workflow "SAXTech MegaMind SAX" in the editor
// 2. Find the "Streaming Format" node (ID: bd9bac51-ce75-43fc-81aa-b7a59145cf73)
// 3. Replace ALL the code in that node with this code
// 4. Save the workflow

const allItems = $input.all();
console.log('[Streaming Format] Starting with items:', allItems.length);

// Initialize response components
let aiResponse = '';
let audioData = null;
let sessionId = 'session_' + Date.now();
let enableTTS = false;
let voiceId = '';
let hasHtml = false;

// Process all input items to extract data
for (const item of allItems) {
    const data = item.json || item;
    console.log('[Streaming Format] Processing item with keys:', Object.keys(data).slice(0, 10));
    
    // Extract AI response (check multiple possible fields)
    if (!aiResponse) {
        aiResponse = data.response || data.text || data.output || data.message || '';
        if (aiResponse) {
            console.log('[Streaming Format] Found AI response, length:', aiResponse.length);
            // Check if response contains HTML
            hasHtml = /<[^>]+>/.test(aiResponse);
        }
    }
    
    // Extract audio data from ElevenLabs
    if (data.audioBase64 || data.audio || data.audioData) {
        audioData = data.audioBase64 || data.audio || data.audioData;
        console.log('[Streaming Format] Found audio data');
    }
    
    // Extract session and voice info
    sessionId = data.sessionId || sessionId;
    enableTTS = data.enableTTS || data.ttsEnabled || enableTTS;
    voiceId = data.voiceId || data.voice || voiceId;
}

// If no response found, create a default
if (!aiResponse) {
    aiResponse = "I'm ready to help. What can I assist you with today?";
    console.log('[Streaming Format] No response found, using default');
}

// CRITICAL: Create proper SSE format for streaming
const chunks = [];

// 1. Send initial connection event
chunks.push({
    type: 'connection',
    data: {
        status: 'connected',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
    }
});

// 2. Split response into words for streaming effect
const words = aiResponse.split(/\s+/);
const chunkSize = 5; // Send 5 words at a time

for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, Math.min(i + chunkSize, words.length)).join(' ');
    chunks.push({
        type: 'content',
        data: {
            text: chunk + (i + chunkSize < words.length ? ' ' : ''),
            isHtml: hasHtml,
            partial: true
        }
    });
}

// 3. Send complete response with HTML flag
chunks.push({
    type: 'complete',
    data: {
        text: aiResponse,
        isHtml: hasHtml,
        hasAudio: !!audioData,
        sessionId: sessionId
    }
});

// 4. Send audio if available
if (audioData && enableTTS) {
    chunks.push({
        type: 'audio',
        data: {
            audio: audioData,
            voiceId: voiceId,
            format: 'base64'
        }
    });
}

// 5. Send done event
chunks.push({
    type: 'done',
    data: {
        status: 'complete',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
    }
});

// Format as SSE stream
const sseStream = chunks.map(chunk => {
    return `data: ${JSON.stringify(chunk)}\n\n`;
}).join('');

console.log('[Streaming Format] Created SSE stream with chunks:', chunks.length);
console.log('[Streaming Format] Response has HTML:', hasHtml);
console.log('[Streaming Format] Audio included:', !!audioData);

// Return both SSE stream and structured data
return {
    json: {
        // SSE formatted stream
        stream: sseStream,
        
        // Structured response for fallback
        response: aiResponse,
        audio: audioData,
        
        // Metadata
        metadata: {
            sessionId: sessionId,
            hasHtml: hasHtml,
            hasAudio: !!audioData,
            enableTTS: enableTTS,
            voiceId: voiceId,
            chunkCount: chunks.length,
            responseLength: aiResponse.length,
            timestamp: new Date().toISOString()
        },
        
        // For webhook response
        webhookResponse: {
            response: aiResponse,
            audio: audioData,
            sessionId: sessionId,
            isHtml: hasHtml,
            streaming: true
        }
    }
};