# Fix ElevenLabs Voice Selection in n8n - COMPLETE INSTRUCTIONS

## The Problem
Your n8n workflow has a node called "Handle ElevenLabs Audio" but it's not properly configured to use the selected voice from your index.html dropdown.

## The Solution - Update the "Handle ElevenLabs Audio" Node

### Step 1: Open n8n and Edit Your Workflow
1. Go to your n8n instance
2. Open the "SAXTech MegaMind SAX" workflow
3. Find the node called **"Handle ElevenLabs Audio"** (it's connected between "Check TTS Enabled" and "Merge TTS Response")

### Step 2: Replace the Code in the Node
1. Double-click on the "Handle ElevenLabs Audio" node
2. Delete ALL the existing code
3. Copy and paste this EXACT code:

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
console.log(`Voice received: voiceId="${voiceId}", voiceName="${voiceName}", enableTTS=${enableTTS}");
console.log('Full voice data:', {
  voice: $json.voice,
  voiceId: $json.voiceId,
  selectedVoice: $json.selectedVoice,
  voiceName: $json.voiceName
});

// Clean text - remove HTML and limit length
let cleanText = text.replace(/<[^>]*>/g, '').trim();

// Hard limit at 2500 characters to prevent token issues
// ElevenLabs charges per character, this is about 2-3 minutes of speech
if (cleanText.length > 2500) {
  cleanText = cleanText.substring(0, 2500);
  // End at sentence boundary
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
  console.log('TTS skipped: enableTTS=' + enableTTS + ', textLength=' + cleanText.length);
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
  console.log(`Making ElevenLabs API call: voiceId=${voiceId}, textLength=${cleanText.length}`);
  
  // Make ElevenLabs API call using n8n's helpers
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
      model_id: 'eleven_turbo_v2',  // Using turbo model for faster generation
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
    timeout: 10000  // 10 second timeout
  });
  
  // Convert to base64
  const audioBase64 = Buffer.from(response).toString('base64');
  
  // Validate audio data
  if (!audioBase64 || audioBase64.length < 100) {
    throw new Error('Invalid audio data received from ElevenLabs');
  }
  
  console.log(`Audio generated successfully: ${audioBase64.length} bytes (base64)`);
  console.log(`Voice used: ${selectedVoice} (ID: ${voiceId})`);
  
  // Return complete response with audio
  return [{
    json: {
      ...$json,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      audioBase64: audioBase64,
      ttsEnabled: true,
      voiceUsed: selectedVoice,
      voiceId: voiceId,
      textLength: cleanText.length,
      audioGenerated: true,
      timestamp: new Date().toISOString()
    }
  }];
  
} catch (error) {
  console.error('ElevenLabs TTS Error:', error.message);
  
  // Check if it's a quota/token error
  const isQuotaError = error.message && (
    error.message.includes('quota') || 
    error.message.includes('limit') || 
    error.message.includes('insufficient') ||
    error.message.includes('429') ||
    error.message.includes('402')
  );
  
  // Pass through without audio on error - DON'T STOP THE WORKFLOW
  return [{
    json: {
      ...$json,
      audioUrl: null,
      audioBase64: null,
      ttsEnabled: false,
      ttsError: error.message,
      ttsErrorType: isQuotaError ? 'quota_exceeded' : 'api_error',
      // Still return the text response even if TTS fails
      response: $json.response
    }
  }];
}
```

### Step 3: Update Your ElevenLabs API Key (if needed)
In the code above, find this line:
```javascript
'xi-api-key': 'sk_94c95a3f46355ef03ad7cc214059cccfd2c492fc1571a2bf',
```

If this API key doesn't work, replace it with your actual ElevenLabs API key.

### Step 4: Save and Activate
1. Click "Done" to save the node
2. Click "Save" to save the workflow
3. Make sure the workflow is **Active** (toggle should be ON)

### Step 5: Test It!
1. Go to your index.html page
2. Select a different voice from the dropdown (Sarah, Daniel, Emily, James, or Charlotte)
3. Type a message and send it
4. You should hear the response in the voice you selected!

## How to Verify It's Working

1. Open your browser's Developer Console (F12)
2. Look for these console messages when you send a message:
   - `Voice selection: requested="daniel", key="daniel", id="onwK4e9ZLuTAKqWW03F9"`
   - `Making ElevenLabs API call: voiceId=onwK4e9ZLuTAKqWW03F9`
   - `Audio generated successfully: [number] bytes (base64)`
   - `Voice used: daniel (ID: onwK4e9ZLuTAKqWW03F9)`

## If It's Still Not Working

1. **Check n8n logs**: Look at the execution history in n8n to see if there are errors
2. **Check API quota**: Make sure your ElevenLabs account has available credits
3. **Verify the workflow is active**: The toggle must be ON
4. **Check the connections**: Make sure "Handle ElevenLabs Audio" is connected:
   - Input: From "Check TTS Enabled" (True branch)
   - Output: To "Merge TTS Response" (Input 1)

## Important: Voice IDs from Your System

Your system is now sending the actual ElevenLabs voice IDs directly, not simple names. The voices configured in your system include:
- **Rachel**: EXAVITQu4vr4xnSDxMaL (Default voice)
- **Tom**: gWf6X7X75oO2lF1dH79K (Your custom voice)
- And other voices from your centralized configuration

The updated code now accepts these voice IDs directly without needing to map them.

## Done!
After following these steps, your voice selection from the dropdown will actually be used to generate the audio. Each voice has different characteristics, so try them all to see which one you prefer!