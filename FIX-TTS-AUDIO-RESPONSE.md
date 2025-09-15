# FIX: TTS Audio Not Being Returned to Frontend

## Problem
The frontend is sending correct TTS settings (enableTTS=true, voice selection) but the webhook response doesn't include the audio data, even though the ElevenLabs TTS node is generating it.

## Root Cause
The Merge node that combines the AI response with TTS audio is not properly passing the audio data through to the webhook response.

## Solution

### Step 0: Fix the Format Agent Response Node (CRITICAL)
The Format Agent Response node needs to properly extract TTS settings from the input.

**Node Name:** `Format Agent Response`
**Code:** Copy from `n8n-format-agent-response-ULTIMATE.js`

This code:
- Searches through ALL inputs to find TTS settings
- Checks webhook data and context data
- Properly sets enableTTS, voiceId, and sessionId
- Returns all necessary fields for TTS processing

### Step 1: Replace the Merge Node with a Code Node
Find the node that merges the Format Agent Response with the TTS output (usually called "Merge TTS with Response" or similar) and replace it with a Code node.

**Node Name:** `Merge TTS Response`
**Code:** Copy from `n8n-merge-tts-response-fix.js`

This code:
- Properly finds both the Format Agent Response and TTS data
- Preserves ALL fields from Format Agent Response
- Adds audio fields (audioBase64, audioData, audioUrl) from TTS
- Handles cases where TTS is disabled or skipped

### Step 2: Update the Webhook Response Node
Find the Code node right before "Respond to Webhook" and update it.

**Node Name:** `Prepare Webhook Response` (or similar)
**Code:** Copy from `n8n-webhook-response-with-audio.js`

This code:
- Properly forwards all audio fields (audioBase64, audioData, audioUrl)
- Preserves TTS metadata (voice, enableTTS, ttsSkipReason)
- Handles preview requests with personalized greetings
- Includes vision/OCR results if present

### Step 3: Verify the Connection Flow
Ensure your workflow follows this order:

1. **Webhook Trigger** → receives request
2. **Prepare Context** → extracts settings and user info
3. **AI Agent** → generates response
4. **Format Agent Response** → formats the AI output
5. **Check TTS Settings** (IF node) → checks if TTS is enabled
   - If YES → **ElevenLabs TTS** → generates audio
   - If NO → skip to merge
6. **Merge TTS Response** (Code node) → combines AI response with audio
7. **Prepare Webhook Response** (Code node) → formats final response
8. **Respond to Webhook** → sends response back to frontend

### Step 4: Test the Fix

1. Open browser console (F12)
2. Enable TTS toggle
3. Send a message
4. Check console for:
   ```
   [Webhook Response] Sending response: {
     hasAudioBase64: true,  // Should be true
     hasAudioData: true,    // Should be true
     ttsEnabled: true
   }
   ```
5. Audio should play automatically

### Step 5: Verify Audio Data Flow

In n8n workflow execution, check each node's output:

1. **ElevenLabs TTS output** should have:
   - `audioBase64` or `audioUrl` field with base64 audio data

2. **Merge TTS Response output** should have:
   - All fields from Format Agent Response
   - Plus `audioBase64`, `audioData`, `audioUrl` from TTS

3. **Prepare Webhook Response output** should have:
   - `response`: The AI text response
   - `audioBase64`: The audio data
   - `audioData`: The audio data (duplicate for compatibility)
   - `enableTTS`: true

## Common Issues

### Issue: Audio still not playing
- Check ElevenLabs API key is valid
- Verify voice IDs are correct in the Prepare Context node
- Check that text is being sent to TTS (not empty)

### Issue: Merge node loses data
- Make sure to use the Code node, not the built-in Merge node
- The built-in Merge node can lose data when one input is empty

### Issue: Preview not working
- Preview requests should have `preview: true` flag
- Should NOT have a `message` field
- Should generate a short greeting

## Voice ID Mapping
```javascript
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',
  'daniel': 'onwK4e9ZLuTAKqWW03F9', 
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'james': 'N2lVS1w4EtoT3dr4eOWO',
  'charlotte': 'XB0fDUnXU5powFXDhCwa'
};
```

## Debug Logging
Enable console logging in n8n to see:
- `[Merge TTS]` - Shows merge process
- `[Webhook Response]` - Shows final response preparation
- `[TTS]` - Shows TTS processing (in ElevenLabs node)

## Final Checklist
- [ ] Merge node replaced with Code node
- [ ] Webhook response node updated
- [ ] Audio fields properly forwarded
- [ ] TTS settings preserved through workflow
- [ ] Frontend receives audioBase64 in response
- [ ] Audio plays when TTS is enabled