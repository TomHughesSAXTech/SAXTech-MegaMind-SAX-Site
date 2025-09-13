# N8N WORKFLOW SETUP - COMPLETE INSTRUCTIONS

## Workflow Structure:

```
[Webhook] → [Your AI Node] → [Code Node 1] → [IF Node] → [ElevenLabs] → [Code Node 2] → [Respond to Webhook]
                                                    ↓
                                             [Code Node 2] (bypass)
```

## Step-by-Step Setup:

### 1. After Your AI Response Node
Add a **Code** node with the contents from `n8n-code-node-complete.js`

### 2. After Code Node 1
Add an **IF** node with condition: `{{ $json.enableTTS === true && $json.ttsText && $json.ttsText.length > 0 }}`

### 3. TRUE Branch → ElevenLabs Node
Configure with:
- Text: `{{ $json.ttsText }}`
- Voice ID: `{{ $json.voiceId }}`
- Model: `eleven_turbo_v2`

### 4. Both Branches → Code Node 2
Add a **Code** node with contents from `n8n-response-combine.js`

### 5. Final Node → Respond to Webhook
With expression: `{{ $json }}`

## Quick Test Commands:

### Test 1: Voice Selection
1. Set dropdown to "Daniel"
2. Turn Audio ON
3. Type: "Hello, test voice"
4. Should hear Daniel's voice

### Test 2: TTS Summary
1. Turn Audio ON
2. Type: "Explain in detail how cloud computing works"
3. Audio should be 5-10 seconds only
4. Full text should display in chat

### Test 3: Conversational Mode
1. Turn Audio ON
2. Select "Emily" voice
3. Tap speaker icon
4. Should hear Emily say greeting

## Voice IDs for Manual Entry:

```
Sarah:     EXAVITQu4vr4xnSDxMaL
Daniel:    onwK4e9ZLuTAKqWW03F9
Emily:     LcfcDJNUP1GQjkzn1xUU
James:     IKne3meq5aSn9XLyUdCD
Charlotte: XB0fDUnXU5powFXDhCwa
```

## Troubleshooting:

If voices still don't change:
1. Check n8n execution logs
2. Look for "TTS Processing:" in console
3. Verify `voiceId` is changing
4. Make sure ElevenLabs node uses `{{ $json.voiceId }}` not hardcoded

If TTS is too long:
1. Check `ttsSummaryLength` is received
2. Verify Code Node 1 is trimming text
3. Look for "ttsSummaryApplied: true" in logs