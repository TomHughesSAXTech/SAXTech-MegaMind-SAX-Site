# Fix TTS Audio Merge Issue - Implementation Guide

## Problem Summary
The ElevenLabs TTS node successfully generates audio (with `audioUrl` containing base64 data), but the merge node before the webhook response is outputting `enableTTS: false` and null audio fields, preventing the frontend from receiving and playing the audio.

## Root Cause
The Merge node before the webhook response is not properly combining the AI response from "Format Agent Response" with the audio output from "ElevenLabs TTS". This results in the audio data being lost.

## Solution: Replace Merge Node with Code Node

### Step 1: Delete or Disable the Problematic Merge Node
- Find the Merge node that comes after both "Format Agent Response" and "ElevenLabs TTS"
- This is the node right before the webhook response
- Delete or disable this node

### Step 2: Add a New Code Node
- Add a new Code node in place of the deleted Merge node
- Name it: "Merge Audio Response"

### Step 3: Configure the Code Node

#### Option A: Single Input Stream (Recommended)
If the ElevenLabs output already contains all necessary fields:

**Use code from:** `n8n-merge-audio-response-FINAL.js`

**Node Settings:**
- Mode: "Run Once for All Items"
- Language: JavaScript

**Connections:**
- Connect the output from ElevenLabs TTS node to this Code node
- The ElevenLabs output should already contain both the AI response AND the audio data

#### Option B: Dual Input Streams
If you need to merge separate outputs from Format Agent Response and ElevenLabs:

**Use code from:** `n8n-merge-dual-inputs.js`

**Node Settings:**
- Mode: "Run Once for All Items"  
- Language: JavaScript

**Connections:**
1. Connect "Format Agent Response" output → Code node (first input)
2. Connect "ElevenLabs TTS" output → Code node (second input)

### Step 4: Connect to Webhook Response
- Connect the Code node output to your webhook response node
- The webhook response should now receive the merged data with audio

## Expected Output Structure
The merged output should contain:
```json
{
  "response": "AI response text",
  "enableTTS": true,
  "audioUrl": "data:audio/mpeg;base64,<base64_audio>",
  "audioBase64": "<base64_audio>",
  "audioData": "<base64_audio>",
  "audioGenerated": true,
  "voiceUsed": "Tom",
  "userProfile": { ... },
  // ... other metadata
}
```

## Verification Steps

1. **Check Code Node Output:**
   - Run the workflow with test data
   - Check the Code node output
   - Verify `enableTTS: true` and audio fields are populated

2. **Check Webhook Response:**
   - Verify the webhook response contains all audio fields
   - Check browser console for the response structure

3. **Frontend Validation:**
   - Confirm the frontend receives `audioUrl` or `audioBase64`
   - Verify audio playback works

## Debugging Tips

### Console Logs
The Code nodes include extensive logging:
- Input data structure
- Audio field detection
- Merge results
- Final output validation

### Common Issues and Fixes

1. **No audio in output:**
   - Check ElevenLabs node is actually running (not skipped)
   - Verify ElevenLabs output contains `audioUrl` field
   - Ensure proper node connections

2. **enableTTS still false:**
   - Verify the Code node is receiving input from ElevenLabs
   - Check that audio fields are being detected
   - Review console logs for "Audio data has audio fields: true"

3. **Audio not playing in frontend:**
   - Verify `audioUrl` format is correct (data:audio/mpeg;base64,...)
   - Check browser console for audio playback errors
   - Ensure frontend audio player supports base64 data URLs

## Alternative Solutions

If the Code node approach doesn't work:

1. **Direct Connection:**
   - Try connecting ElevenLabs output directly to webhook response
   - The ElevenLabs output already contains all necessary fields

2. **Multiple Webhook Responses:**
   - Use conditional logic to send different responses
   - One path for TTS-enabled, one for text-only

3. **Function Node:**
   - Use a Function node instead of Code node
   - Provides more control over data transformation

## Files Created
- `n8n-merge-audio-response-FINAL.js` - Single input merge solution
- `n8n-merge-dual-inputs.js` - Dual input merge solution
- `n8n-webhook-response-DEBUG.js` - Debug webhook response
- Various helper scripts in the directory

## Next Steps
1. Implement the Code node solution
2. Test with actual TTS requests
3. Monitor logs for successful audio merging
4. Verify frontend receives and plays audio