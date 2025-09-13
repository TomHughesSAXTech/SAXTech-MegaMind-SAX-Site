# QUICK FIX - Just Replace One Node!

## The Problem:
Your "Handle ElevenLabs Audio" node has WRONG voice IDs for Emily and James.

## The Fix:
Replace the ENTIRE code in "Handle ElevenLabs Audio" node with the contents from:
**`n8n-FIXED-ELEVENLABS-NODE.js`**

## What This Fixes:

### ✅ Correct Voice IDs:
- Sarah: `EXAVITQu4vr4xnSDxMaL` ✓
- Daniel: `onwK4e9ZLuTAKqWW03F9` ✓
- Emily: `LcfcDJNUP1GQjkzn1xUU` ✓ (was wrong)
- James: `IKne3meq5aSn9XLyUdCD` ✓ (was wrong)
- Charlotte: `XB0fDUnXU5powFXDhCwa` ✓

### ✅ Better TTS Settings:
- Model: `eleven_turbo_v2` (faster)
- Stability: 0.5 (more natural)
- Style: 0.3 (conversational)
- Speaker Boost: false (cleaner)

## That's It!
Just copy the entire contents of `n8n-FIXED-ELEVENLABS-NODE.js` and paste it into your "Handle ElevenLabs Audio" code node.

Your "Format Agent Response" node is already good - it has the correct voice mapping and creates short summaries.