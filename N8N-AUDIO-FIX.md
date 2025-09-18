# N8N Workflow Audio Fix Instructions

## Problem Summary
The n8n workflow is NOT returning audio data even though TTS is enabled. The response shows:
```
Audio check after streaming complete: {hasAudioData: false, audioDataType: 'object', audioDataLength: 0, firstChars: 'none', ttsEnabled: true}
```

## Root Cause
The n8n workflow's "MegaMind SAGE" node is not including audio data in its NDJSON streaming response.

## Fix Required in n8n Workflow

### 1. Check the "MegaMind SAGE" Node
In your n8n workflow for the webhook `megamind-chat`:

1. Open the "MegaMind SAGE" node
2. Ensure it has access to the TTS audio data from previous nodes
3. Modify the output format to include audio

### 2. Modify the SSE Response Node
The SSE/NDJSON response should include audio in the "end" message:

```javascript
// In your n8n Code node that sends the streaming response
const messages = [];

// Add the text chunks
messages.push({
  type: "item",
  content: responseText
});

// Add the end message WITH audio
messages.push({
  type: "end",
  metadata: {
    nodeId: "26b3546e-3010-4e51-ac0d-ac3e92c270be",
    nodeName: "MegaMind SAGE",
    itemIndex: 0,
    runIndex: 0,
    timestamp: Date.now(),
    // Add audio data here
    audioBase64: $json.audioBase64 || $json.audioData || null
  },
  // Also include at root level for compatibility
  audioBase64: $json.audioBase64 || $json.audioData || null
});

// Send as NDJSON
return messages.map(msg => JSON.stringify(msg)).join('\n');
```

### 3. Alternative: Use Standard JSON Response with Audio
If streaming is not required, switch to a standard JSON response:

```javascript
return {
  response: responseText,
  audioBase64: audioBase64Data, // Your TTS audio data
  model: "gpt-4",
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50
  }
};
```

### 4. Ensure TTS Node is Connected
Make sure your TTS node (ElevenLabs or similar) is properly connected and its output is being passed to the final response node.

Check:
- The TTS node is receiving the response text
- The TTS node is successfully generating audio
- The audio data is being passed to the response node
- The response node is including the audio in its output

### 5. Debug Steps
Add a Code node before your response to log what data is available:

```javascript
console.log('Available data:', {
  hasAudioBase64: !!$json.audioBase64,
  hasAudioData: !!$json.audioData,
  hasAudio: !!$json.audio,
  audioLength: ($json.audioBase64 || $json.audioData || $json.audio || '').length,
  allKeys: Object.keys($json)
});

return $json;
```

## Expected Response Format
The frontend expects audio in one of these formats:

### Option 1: NDJSON with Audio in End Message
```
{"type":"item","content":"Hello, how can I help?"}
{"type":"end","metadata":{...},"audioBase64":"UklGRi4AAABXQVZFZm10..."}
```

### Option 2: Standard JSON with Audio
```json
{
  "response": "Hello, how can I help?",
  "audioBase64": "UklGRi4AAABXQVZFZm10...",
  "model": "gpt-4"
}
```

## Testing
1. Enable TTS toggle in the UI
2. Send a test message
3. Check browser console for audio data logs
4. The console should show: `Audio data received, length: [large number]`

## Current Frontend Code
The frontend is already set up to handle audio in these locations:
- Root level: `audioBase64`, `audioData`, `audio`
- In metadata: `metadata.audioBase64`, `metadata.audioData`
- In end message: `audioBase64`, `audioData`

The issue is that the n8n workflow is not populating any of these fields with the TTS audio data.