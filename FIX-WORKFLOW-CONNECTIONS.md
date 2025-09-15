# FIX: n8n Workflow Connections for TTS

## The Problem
Format Agent Response is only receiving the AI Agent output, not the TTS settings from Simple Memory Input Fix.

## Critical Workflow Connection Setup

### Connection Flow MUST be:

```
[Webhook]
    ↓
[Prepare Context and Route]
    ↓
[Simple Memory Input Fix] ──────┐ (PRESERVES TTS settings)
    ↓                           │
[Memory Nodes/AI Agent]         │
    ↓                           │
[AI Agent Output] ──────────────┤
                                ↓
                    [Format Agent Response]  ← BOTH inputs must connect here!
                                ↓
                        [Check TTS Enabled]
                            ↙        ↘
                    [ElevenLabs]    [Skip TTS]
                            ↘        ↙
                        [Merge TTS Response]
                                ↓
                    [Prepare Webhook Response]
                                ↓
                        [Respond to Webhook]
```

## CRITICAL: Format Agent Response Connections

The **Format Agent Response** node MUST receive TWO inputs:

1. **Input 1**: From AI Agent (contains the `output` text)
2. **Input 2**: From Simple Memory Input Fix (contains TTS settings)

### How to Connect in n8n:

1. **Delete existing connection** to Format Agent Response
2. **Connect AI Agent output** to Format Agent Response
3. **ALSO connect Simple Memory Input Fix** to Format Agent Response
   - Click and drag from Simple Memory Input Fix output
   - Connect to the SAME Format Agent Response node
   - You should see 2 connection lines going into Format Agent Response

### Alternative: Use Merge Node First

If connecting both inputs directly doesn't work:

1. Add a **Merge** node (type: Combine, Mode: Merge By Index)
2. Connect AI Agent output to Merge input 1
3. Connect Simple Memory Input Fix to Merge input 2
4. Connect Merge output to Format Agent Response

## Verification

After connecting properly, when you run the workflow:

1. **Simple Memory Input Fix** output should show:
   - `enableTTS: true`
   - `voiceId: "gWf6X7X75oO2lF1dH79K"`
   - `voiceName: "Tom"`

2. **Format Agent Response** should show:
   - `inputsProcessed: 2` (or 1 if using the workflow lookup version)
   - `enableTTS: true`
   - `voiceId: "gWf6X7X75oO2lF1dH79K"`
   - `ttsEnabled: true`

3. **Check TTS Enabled** should evaluate to TRUE
4. **ElevenLabs TTS** should run and generate audio
5. **Webhook Response** should include `audioBase64` with data

## Quick Fix if Connections are Complex

Use the **n8n-format-agent-response-BOTH-INPUTS.js** code which:
- Automatically looks up TTS settings from the workflow if only 1 input received
- Works even if the connection isn't perfect
- Fetches data from "Simple Memory Input Fix" node directly

## Common Issues

### Issue: Format Agent Response shows enableTTS: false
- **Cause**: Not receiving TTS settings
- **Fix**: Ensure both connections are made OR use the BOTH-INPUTS version

### Issue: Format Agent Response shows inputsProcessed: 1
- **Cause**: Only receiving AI output
- **Fix**: Add connection from Simple Memory Input Fix

### Issue: Can't connect two nodes to one input
- **Cause**: n8n connection limitation
- **Fix**: Use a Merge node first, or use the workflow-lookup version