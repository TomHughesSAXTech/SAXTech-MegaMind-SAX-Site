# N8N QUICK SETUP FOR YOUR WORKFLOW

You already have the workflow structure:
```
Agent → Format Agent Response Code → Check TTS Enabled → (true) → Handle ElevenLabs Audio → Merge TTS Response → Webhook response
                                                      ↓ (false) → Merge TTS Response → Webhook response
```

## 🔧 Update Each Node:

### 1. **Format Agent Response Code**
Replace entire code with contents from: `n8n-FORMAT-AGENT-RESPONSE.js`

### 2. **Check TTS Enabled (IF Node)**
Set condition to:
```
{{ $json.enableTTS === true && $json.ttsText && $json.ttsText.length > 0 }}
```

### 3. **Handle ElevenLabs Audio**
In the ElevenLabs node, set:
- **Text:** `{{ $json.ttsText }}`
- **Voice ID:** `{{ $json.voiceId }}`
- **Model:** `eleven_turbo_v2`

### 4. **Merge TTS Response**
Replace entire code with contents from: `n8n-MERGE-TTS-RESPONSE.js`

### 5. **Webhook Response**
Should just be: `{{ $json }}`

## ✅ That's It!

### Test:
1. Change dropdown to "Daniel" → Should hear Daniel
2. Type long message → Audio should be 5-10 seconds
3. Tap speaker for conversational mode → Short greeting

## 🎯 Voice IDs (if ElevenLabs needs manual entry):
- Sarah: `EXAVITQu4vr4xnSDxMaL`
- Daniel: `onwK4e9ZLuTAKqWW03F9`
- Emily: `LcfcDJNUP1GQjkzn1xUU`
- James: `IKne3meq5aSn9XLyUdCD`
- Charlotte: `XB0fDUnXU5powFXDhCwa`