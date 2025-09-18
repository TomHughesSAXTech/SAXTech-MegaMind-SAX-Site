# Fix Audio Issue in n8n Workflow

## Problem
The audio is not being passed through from n8n to the client, even though:
- Voice is selected (e.g., "Mark (Male Voice)" with ID `1SM7GgM6IMuvQlz2BwM3`)
- TTS is enabled
- The client is sending the voice settings to n8n
- The client is looking for audio fields in the response

## Root Cause
Looking at your n8n workflow export, the issue is clear:
**There is no ElevenLabs TTS node in the workflow to generate audio.**

The workflow has:
1. `Format Agent Response` nodes that prepare TTS settings
2. The nodes properly extract `enableTTS`, `voiceId`, `selectedVoice` from the request
3. BUT there's no ElevenLabs node connected to actually generate the audio

## Current Workflow Flow
```
Webhook → Prepare Context → Agent → Format Response → Webhook Response
```

## What Should Be Added
```
Webhook → Prepare Context → Agent → Format Response → ElevenLabs TTS → Merge Audio → Webhook Response
```

## Solution: Add ElevenLabs Node to n8n

### Step 1: Add ElevenLabs TTS Node
After the "Format Agent Response" node and before "Webhook Response", add:

1. **ElevenLabs Text to Speech** node with these settings:
   - Voice ID: `{{ $json.voiceId }}`
   - Text: `{{ $json.ttsText || $json.response }}`
   - Model: `eleven_monolingual_v1` or `eleven_multilingual_v2`
   - Output Format: `mp3_44100_128`

### Step 2: Add Merge Node
After ElevenLabs, add a **Merge** node to combine:
- Input 1: Format Agent Response output
- Input 2: ElevenLabs audio output
- Mode: Combine by Position
- Output: All Input Data

### Step 3: Add Code Node to Format Final Response
Create a "Merge Audio Response" Code node with this code:

```javascript
// Merge AI Response with ElevenLabs Audio
const aiResponse = $input.all()[0].json;
const audioInput = $input.all()[1];

// Initialize the merged output with AI response
let mergedOutput = { ...aiResponse };

// Add audio data if available
if (audioInput && audioInput.binary && audioInput.binary.data) {
  // Convert binary audio to base64
  const audioBase64 = audioInput.binary.data;
  
  mergedOutput.audioBase64 = audioBase64;
  mergedOutput.audioData = audioBase64;
  mergedOutput.audioGenerated = true;
  mergedOutput.hasAudio = true;
}

// Ensure all audio flags are set
if (mergedOutput.audioBase64) {
  mergedOutput.enableTTS = true;
  mergedOutput.ttsEnabled = true;
  mergedOutput.audioGenerated = true;
}

return [{ json: mergedOutput }];
```

### Step 4: Update Webhook Response
Make sure the Webhook Response node returns the merged output with audio fields.

## Conditional TTS (Optional)
To save ElevenLabs credits, add an IF node before ElevenLabs:
- Condition: `{{ $json.enableTTS === true && $json.skipTTS !== true }}`
- True branch: Goes to ElevenLabs
- False branch: Goes directly to Webhook Response

## Expected Audio Fields in Response
After implementing this, the client will receive:
```json
{
  "response": "Your assistant's text response",
  "audioBase64": "base64_encoded_audio_data_here",
  "audioData": "base64_encoded_audio_data_here",
  "audioGenerated": true,
  "enableTTS": true,
  "voiceId": "1SM7GgM6IMuvQlz2BwM3",
  "voiceName": "Mark"
}
```

## Test the Audio
1. Make sure ElevenLabs API key is configured in n8n credentials
2. Test with a simple message
3. Check n8n execution logs to see if audio is generated
4. Check browser console for "Found audioBase64" messages

## Client-Side Verification
The client code is already set up correctly to handle audio:
- It checks for `audioBase64`, `audioData`, and `audio` fields
- It properly cleans and plays the audio
- The issue is purely that n8n isn't sending audio data

## Quick Test Without ElevenLabs
To test if the client audio playback works, you can add a Code node in n8n that returns dummy audio:

```javascript
return [{
  json: {
    response: "This is a test response",
    // This is a very short silent MP3 (about 0.1 seconds)
    audioBase64: "SUQzAwAAAAAAIVRTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAABAAABhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tAxAAAAAAGkAAAABMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+0DEAAAAAAAAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    enableTTS: true,
    audioGenerated: true
  }
}];
```

This will help verify if the client can play audio when it's provided.