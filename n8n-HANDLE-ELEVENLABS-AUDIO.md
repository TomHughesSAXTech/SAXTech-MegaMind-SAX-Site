# HANDLE ELEVENLABS AUDIO NODE CONFIGURATION

## ElevenLabs Text to Speech Node Settings:

### Main Configuration:

1. **Text Field:**
   ```
   {{ $json.ttsText }}
   ```

2. **Voice ID Field:**
   ```
   {{ $json.voiceId }}
   ```
   
   **OR if Voice ID doesn't accept expressions, use one of these voice IDs:**
   - Sarah: `EXAVITQu4vr4xnSDxMaL`
   - Daniel: `onwK4e9ZLuTAKqWW03F9`
   - Emily: `LcfcDJNUP1GQjkzn1xUU`
   - James: `IKne3meq5aSn9XLyUdCD`
   - Charlotte: `XB0fDUnXU5powFXDhCwa`

3. **Model:**
   ```
   eleven_turbo_v2
   ```

4. **Voice Settings:**
   - Stability: `0.5`
   - Similarity Boost: `0.75`
   - Style: `0.3`
   - Use Speaker Boost: `false`

5. **Output Options:**
   - Output Format: `mp3_44100_128`
   - Optimize Streaming Latency: `3`

---

## Alternative: If ElevenLabs doesn't accept dynamic Voice ID

Add a **Switch** node BEFORE ElevenLabs:

### Switch Node Configuration:
- **Mode:** Expression
- **Output:** Output Key
- **Expression:** `{{ $json.selectedVoice }}`

### Rules:
1. When `sarah` → Route to ElevenLabs (Sarah)
2. When `daniel` → Route to ElevenLabs (Daniel)
3. When `emily` → Route to ElevenLabs (Emily)
4. When `james` → Route to ElevenLabs (James)
5. When `charlotte` → Route to ElevenLabs (Charlotte)
6. Default → Route to ElevenLabs (Sarah)

Each route connects to a different ElevenLabs node with the hardcoded Voice ID.