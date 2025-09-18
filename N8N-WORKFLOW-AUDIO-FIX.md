# N8N Workflow Audio Fix - Implementation Guide

## The Problem
Your workflow generates audio correctly (via "Handle ElevenLabs Audio" node) but the "Respond to Webhook" node isn't including it in the streaming response.

## Quick Fix: Change Response Mode

### Option 1: Switch to Standard JSON Response (Easiest)
1. Open the **"Respond to Webhook"** node
2. Change `responseMode` from `"streaming"` to `"responseNode"`
3. This will send the complete response with audio as standard JSON

### Option 2: Add a Code Node Before Response (For Streaming)
If you need to keep streaming, add a new Code node between "Merge" and "Respond to Webhook":

```javascript
// NEW CODE NODE: "Prepare Streaming Response"
// Place this BETWEEN "Merge" and "Respond to Webhook"

const input = $input.first().json;

// Extract all the data
const response = input.response || input.text || '';
const audioBase64 = input.audioBase64 || input.audioData || input.audioUrl?.split(',')[1] || null;
const hasAudio = !!audioBase64;

console.log('[Streaming Response] Preparing:', {
  responseLength: response.length,
  hasAudio: hasAudio,
  audioLength: audioBase64 ? audioBase64.length : 0
});

// Build NDJSON streaming response with audio
const messages = [];

// Split response into chunks if needed
const chunks = response.match(/.{1,500}/g) || [response];

// Add text chunks
chunks.forEach(chunk => {
  messages.push({
    type: "item",
    content: chunk
  });
});

// Add end message WITH AUDIO
const endMessage = {
  type: "end",
  metadata: {
    nodeId: "26b3546e-3010-4e51-ac0d-ac3e92c270be",
    nodeName: "MegaMind SAGE",
    itemIndex: 0,
    runIndex: 0,
    timestamp: Date.now(),
    model: "gpt-4.1-mini"
  }
};

// CRITICAL: Add audio to the end message
if (hasAudio) {
  endMessage.audioBase64 = audioBase64;
  endMessage.audioData = audioBase64; // Duplicate for compatibility
  endMessage.metadata.audioBase64 = audioBase64;
  endMessage.metadata.hasAudio = true;
}

messages.push(endMessage);

// Convert to NDJSON format
const ndjson = messages.map(msg => JSON.stringify(msg)).join('\n');

// Return for streaming
return [{
  json: {
    streamingResponse: ndjson,
    messages: messages,
    hasAudio: hasAudio
  }
}];
```

## Updated Workflow Connection

Your workflow connections should be:
1. **Webhook** → Prepare OCR Data → ... → MegaMind SAGE
2. **MegaMind SAGE** → Format Agent Response
3. **Format Agent Response** → Check TTS Enabled
4. **Check TTS Enabled** (True) → Handle ElevenLabs Audio → Merge
5. **Check TTS Enabled** (False) → Merge
6. **Merge** → **[NEW] Prepare Streaming Response** → Respond to Webhook

## Testing the Fix

### Test 1: Check Audio Generation
Add this debug code to your "Handle ElevenLabs Audio" node (at the end):
```javascript
console.log('[ElevenLabs] Audio generated:', {
  audioLength: audioBase64 ? audioBase64.length : 0,
  hasAudio: !!audioBase64
});
```

### Test 2: Check Merge Node Output
Update your "Merge" node to log what it's outputting:
```javascript
console.log('=== MERGED OUTPUT FOR WEBHOOK ===');
console.log('Has audio for streaming:', !!mergedOutput.audioBase64);
console.log('Audio length:', mergedOutput.audioBase64 ? mergedOutput.audioBase64.length : 0);
```

### Test 3: Browser Console
When testing, your browser console should show:
```
Audio data received in streaming, length: 245000
Playing audio with fallback method
```

## Alternative: Simple Non-Streaming Fix

If you don't need streaming, just modify the "Respond to Webhook" node parameters:

```json
{
  "parameters": {
    "responseMode": "responseNode",
    "respondWith": "json",
    "responseBody": "={{ $json }}",
    "options": {
      "responseHeaders": {
        "entries": [
          {
            "name": "Content-Type",
            "value": "application/json"
          },
          {
            "name": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      }
    }
  }
}
```

This will send the complete response including audio as standard JSON.

## Verify Audio Path

The audio data flows through your workflow like this:
1. **Handle ElevenLabs Audio** generates `audioBase64`
2. **Merge** node combines text response with `audioBase64`
3. **[Missing Step]** - Need to format for streaming
4. **Respond to Webhook** sends the response

The missing step is formatting the audio into the NDJSON stream. Either:
- Add the "Prepare Streaming Response" code node (Option 2)
- Switch to non-streaming JSON response (Option 1)

## Quick Test Command

After making changes, test with:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/megamind-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, testing audio",
    "sessionId": "test-session",
    "enableTTS": true,
    "voice": "EXAVITQu4vr4xnSDxMaL"
  }' | grep audioBase64
```

If audio is working, you should see `audioBase64` in the response.