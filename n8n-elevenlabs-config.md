# ELEVENLABS TTS NODE CONFIGURATION

## Node Settings:

### 1. Text Field:
```
{{ $json.ttsText }}
```

### 2. Voice ID Field:
```
{{ $json.voiceId }}
```

### 3. Model Selection:
```
eleven_turbo_v2
```

### 4. Voice Settings (if available):
- **Stability**: 0.5
- **Similarity Boost**: 0.75
- **Style**: 0.3
- **Use Speaker Boost**: false

### 5. Output Format:
- **Format**: mp3_44100_128
- **Optimize Streaming Latency**: 3

## Alternative: If Voice ID Field Doesn't Accept Expression

Use a Switch node before ElevenLabs with this configuration:

### Switch Node Settings:
**Mode**: Expression
**Output**: Route to Output Index
**Expression**:
```javascript
{{ $json.selectedVoice }}
```

### Routing Rules:
- If value equals `sarah` → Route 0 → ElevenLabs with Sarah voice
- If value equals `daniel` → Route 1 → ElevenLabs with Daniel voice
- If value equals `emily` → Route 2 → ElevenLabs with Emily voice
- If value equals `james` → Route 3 → ElevenLabs with James voice
- If value equals `charlotte` → Route 4 → ElevenLabs with Charlotte voice
- Fallback → Route 0 (Sarah)

Each route goes to a separate ElevenLabs node with the hardcoded voice ID.