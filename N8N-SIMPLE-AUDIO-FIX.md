# Simple Audio Fix for N8N Workflow

## The Problem
Audio is not playing because the "Respond to Webhook" node is in streaming mode but doesn't include audio data in the stream.

## Quick Fix (Recommended)
Change the "Respond to Webhook" node from streaming to standard JSON mode:

### Step 1: Find the "Respond to Webhook" Node
In your n8n workflow, locate the final "Respond to Webhook" node (usually at the end of your workflow).

### Step 2: Change Response Mode
1. Click on the "Respond to Webhook" node to open its settings
2. Find the **Response Mode** setting
3. Change it from `When Last Node Finishes (Streaming)` to `When Last Node Finishes`
4. Save the node

### Step 3: Ensure JSON Output
The node should output:
```json
{
  "response": "AI response text here",
  "audioBase64": "base64 encoded audio data here"
}
```

## Alternative Fix (If You Need Streaming)
If you must keep streaming mode, add a Code node between Merge and Respond to Webhook:

### Add Code Node
1. Insert a new **Code** node between your Merge node and Respond to Webhook
2. Use this code:

```javascript
// Get inputs
const aiResponse = $input.item.json.response || $input.item.json.text || '';
const audioBase64 = $input.item.json.audioBase64 || $input.item.json.audioData || null;

// Return standard JSON (for non-streaming mode)
if (!$node["Respond to Webhook"].json.streaming) {
  return {
    json: {
      response: aiResponse,
      audioBase64: audioBase64
    }
  };
}

// Format for streaming (NDJSON)
const messages = [
  {
    type: "begin",
    metadata: { timestamp: Date.now() }
  },
  {
    type: "item",
    content: aiResponse
  },
  {
    type: "end",
    audioBase64: audioBase64,
    metadata: { 
      audioBase64: audioBase64,
      timestamp: Date.now()
    }
  }
];

return {
  json: {
    streamingResponse: messages.map(m => JSON.stringify(m)).join('\n')
  }
};
```

## Testing the Fix

### Test with curl:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/megamind-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, testing audio",
    "sessionId": "test-session",
    "enableTTS": true,
    "voice": "EXAVITQu4vr4xnSDxMaL"
  }' | jq .
```

### Expected Response (Standard JSON Mode):
```json
{
  "response": "Hello! How can I help you today?",
  "audioBase64": "//uQxAAAAA... (long base64 string)"
}
```

### Expected Response (Streaming Mode with Code Fix):
```
{"type":"begin","metadata":{"timestamp":1234567890}}
{"type":"item","content":"Hello! How can I help you today?"}
{"type":"end","audioBase64":"//uQxAAAAA...","metadata":{"audioBase64":"//uQxAAAAA...","timestamp":1234567891}}
```

## Why This Works
- **Standard JSON mode**: Returns all data at once, including audio
- **Streaming mode**: Sends data progressively but needs explicit audio inclusion
- The frontend is already set up to handle both formats

## Verification
After making the change:
1. Test with audio enabled
2. Check browser console for "🎵 Audio data detected" message
3. Audio should play automatically after response