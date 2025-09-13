# N8N Workflow Updates for Voice Selection and TTS Summary Fix

## Issues to Fix:
1. **Voice selection not working** - Always uses Sarah regardless of selection
2. **TTS summaries too long** - Should be 5-10 seconds max

## Required Updates:

### 1. Voice Selection Fix

In your **ElevenLabs TTS Node**, update the voice selection logic:

```javascript
// OLD - Incorrect voice selection
const voice = "Sarah";  // Hardcoded

// NEW - Use the selected voice from the webhook
const selectedVoice = $json.selectedVoice || $json.voice || 'sarah';

// Map voice names to ElevenLabs voice IDs
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',     // Sarah - Female Professional
  'daniel': 'onwK4e9ZLuTAKqWW03F9',    // Daniel - Male Professional  
  'emily': 'LcfcDJNUP1GQjkzn1xUU',     // Emily - British Female
  'james': 'IKne3meq5aSn9XLyUdCD',     // James - Deep Male
  'charlotte': 'XB0fDUnXU5powFXDhCwa'  // Charlotte - Energetic Female
};

// Use the mapped voice ID or default to Sarah
const voiceId = voiceMap[selectedVoice.toLowerCase()] || voiceMap['sarah'];
```

### 2. TTS Summary Length Fix

In your **Code Node** that prepares the TTS text, add this logic:

```javascript
// Check if TTS is enabled and get summary length preference
const enableTTS = $json.enableTTS || false;
const ttsSummaryLength = $json.ttsSummaryLength || 'normal';

// Get the AI response
let ttsText = $json.response || '';

// If short summary is requested, create a brief version
if (enableTTS && ttsSummaryLength === 'short') {
  // For preview requests, use a short greeting
  if ($json.preview === true) {
    const firstName = $json.userProfile?.givenName || $json.userProfile?.name?.split(' ')[0] || '';
    ttsText = firstName 
      ? `Hello ${firstName}! I'm ready to help. What can I do for you today?`
      : "Hello! I'm ready to assist you. What can I do for you today?";
  } else {
    // For regular messages, create a 5-10 second summary
    // Split response into sentences
    const sentences = ttsText.match(/[^.!?]+[.!?]+/g) || [ttsText];
    
    // Take first 2-3 sentences or first 150 characters
    if (sentences.length > 3) {
      ttsText = sentences.slice(0, 2).join(' ') + ' I've provided more details in the text response.';
    } else if (ttsText.length > 150) {
      // Find a good break point around 150 characters
      let cutoff = ttsText.substring(0, 150).lastIndexOf(' ');
      if (cutoff === -1) cutoff = 150;
      ttsText = ttsText.substring(0, cutoff) + '... See the full response below.';
    }
    // Already short enough - use as is
  }
}

// Pass both full response and TTS text
return {
  response: $json.response,  // Full text response
  ttsText: enableTTS ? ttsText : null,  // Short TTS version or null
  enableTTS: enableTTS,
  selectedVoice: $json.selectedVoice || $json.voice || 'sarah'
};
```

### 3. Update the ElevenLabs Node Configuration

In the **ElevenLabs Text to Speech** node:

1. **Text Field**: Use `{{ $json.ttsText }}` instead of `{{ $json.response }}`
2. **Voice ID Field**: Use the expression with the voice mapping from step 1
3. **Model**: Use `eleven_turbo_v2` for faster generation
4. **Voice Settings** (if available):
   - Stability: 0.5
   - Similarity Boost: 0.75
   - Style: 0.3 (for more natural conversation)

### 4. Conditional TTS Generation

Add an **IF** node before the ElevenLabs node:

```javascript
// Condition: Only generate TTS if enabled and text exists
{{ $json.enableTTS === true && $json.ttsText && $json.ttsText.length > 0 }}
```

### 5. Update the Response Combine Node

Make sure your final response includes the audio data correctly:

```javascript
return {
  response: $('YourAINode').item.json.response,  // Full text
  audioBase64: $('ElevenLabs').item?.json?.audio || null,  // Audio if generated
  audioData: $('ElevenLabs').item?.json?.audio || null,     // Duplicate for compatibility
  voice: $json.selectedVoice || 'sarah',
  ttsSummaryUsed: $json.ttsSummaryLength === 'short'
};
```

## Testing:

1. **Test voice selection**: 
   - Change dropdown to "Daniel"
   - Send a message with Audio ON
   - Console should show: `Voice and TTS settings: {selectedVoice: "daniel"...}`
   - Audio should be in Daniel's voice

2. **Test TTS summary length**:
   - Send a long message that generates a long response
   - Audio should be only 5-10 seconds (2-3 sentences)
   - Full text should still appear in chat

3. **Test preview**:
   - Turn on Audio
   - Tap speaker icon
   - Should get a short greeting in the selected voice

## Voice ID Reference:

```javascript
const ELEVENLABS_VOICES = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',      // Professional Female
  'daniel': 'onwK4e9ZLuTAKqWW03F9',     // Professional Male
  'emily': 'LcfcDJNUP1GQjkzn1xUU',      // British Female  
  'james': 'IKne3meq5aSn9XLyUdCD',      // Deep Male
  'charlotte': 'XB0fDUnXU5powFXDhCwa'   // Energetic Female
};
```

## Debug Tips:

1. Add a **Code** node after the webhook to log what's received:
```javascript
console.log('Webhook received:', {
  voice: $json.voice,
  selectedVoice: $json.selectedVoice,
  enableTTS: $json.enableTTS,
  ttsSummaryLength: $json.ttsSummaryLength,
  preview: $json.preview
});
return $json;
```

2. Add logging before ElevenLabs to confirm voice selection:
```javascript
console.log('Sending to ElevenLabs:', {
  voiceId: voiceId,
  textLength: ttsText.length,
  first50Chars: ttsText.substring(0, 50)
});
```

This should fix both the voice selection issue and keep TTS responses short and efficient!