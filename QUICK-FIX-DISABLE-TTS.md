# Quick Fix - Disable TTS in Your Workflow

The issue is that your workflow is trying to use a "Handle ElevenLabs Audio" node that doesn't exist. Here's how to fix it immediately:

## Option 1: Disable TTS Check (QUICKEST FIX)

1. Open your n8n workflow "SAXTech MegaMind SAX"
2. Find the node called **"Check TTS Enabled"** (it's an IF node)
3. Double-click to edit it
4. Change the condition from:
   ```
   enableTTS !== false
   ```
   To:
   ```
   false
   ```
5. Save the workflow

This will bypass all TTS processing and your chat will work again immediately.

## Option 2: Add the Missing Node

If you want to actually fix the voice selection:

1. In your n8n workflow, add a new **Code** node
2. Name it exactly: **"Handle ElevenLabs Audio"**
3. Connect it between "Check TTS Enabled" (True output) and "Merge TTS Response" (Input 1)
4. Paste this code:

```javascript
// ElevenLabs TTS Handler - Generates audio using selected voice
// This handles: Direct Voice IDs + API Call + Binary Conversion

// Get text from either ttsText (shortened) or response
const text = $json.ttsText || $json.response || $json.text || '';

// Get voice ID - frontend now sends the actual ElevenLabs voice ID directly
// Check multiple fields for compatibility
const voiceId = $json.voice || $json.voiceId || $json.selectedVoice || 'EXAVITQu4vr4xnSDxMaL';
const voiceName = $json.voiceName || 'Rachel';
const enableTTS = $json.enableTTS !== false;

// Log what we received
console.log(`Voice received: voiceId="${voiceId}", voiceName="${voiceName}", enableTTS=${enableTTS}"`);

// Clean text - remove HTML and limit length
let cleanText = text.replace(/<[^>]*>/g, '').trim();

// Hard limit at 2500 characters
if (cleanText.length > 2500) {
  cleanText = cleanText.substring(0, 2500);
  const lastPeriod = cleanText.lastIndexOf('.');
  const lastQuestion = cleanText.lastIndexOf('?');
  const lastExclamation = cleanText.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > 2000) {
    cleanText = cleanText.substring(0, lastSentenceEnd + 1);
  }
}

// If TTS disabled or no text, pass through without audio
if (!enableTTS || !cleanText || cleanText.length < 5) {
  return [{
    json: {
      ...$json,
      audioUrl: null,
      audioBase64: null,
      ttsEnabled: false,
      ttsSkipReason: !enableTTS ? 'disabled' : 'no_text'
    }
  }];
}

try {
  // Make ElevenLabs API call
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': 'sk_94c95a3f46355ef03ad7cc214059cccfd2c492fc1571a2bf',
      'Content-Type': 'application/json'
    },
    body: {
      text: cleanText,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: false
      }
    },
    json: true,
    encoding: 'arraybuffer',
    returnFullResponse: false,
    timeout: 10000
  });
  
  // Convert to base64
  const audioBase64 = Buffer.from(response).toString('base64');
  
  console.log(`Audio generated successfully: ${audioBase64.length} bytes (base64)`);
  console.log(`Voice used: ${voiceName} (ID: ${voiceId})`);
  
  // Return complete response with audio
  return [{
    json: {
      ...$json,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      audioBase64: audioBase64,
      ttsEnabled: true,
      voiceUsed: voiceName,
      voiceId: voiceId,
      textLength: cleanText.length,
      audioGenerated: true,
      timestamp: new Date().toISOString()
    }
  }];
  
} catch (error) {
  console.error('ElevenLabs TTS Error:', error.message);
  
  // Pass through without audio on error - DON'T STOP THE WORKFLOW
  return [{
    json: {
      ...$json,
      audioUrl: null,
      audioBase64: null,
      ttsEnabled: false,
      ttsError: error.message,
      response: $json.response
    }
  }];
}
```

5. Save and activate the workflow

## What Was Wrong

Your workflow had an IF node checking for TTS enabled, but when it was true, it tried to go to a node called "Handle ElevenLabs Audio" that didn't exist in the workflow. This caused the execution to fail and return an empty response.

## Test It

After applying either fix:
1. Go to your index.html page
2. Type a message and send it
3. You should now get responses!

If you used Option 1, you won't have audio but the chat will work.
If you used Option 2, the voice selection should work properly with your Tom voice!