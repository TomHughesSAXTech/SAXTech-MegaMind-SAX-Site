# Fix Voice Selection in n8n Workflow

## Problem
The frontend is sending the correct voice ID (e.g., `gWf6X7X75oO2lF1dH79K` for Tom), but the workflow always defaults to Rachel's voice (`EXAVITQu4vr4xnSDxMaL`).

## Root Cause
The voice data from the webhook is not being properly extracted and passed through the workflow nodes. The "Prepare Context and Route" node and "Format Agent Response" node are not handling voice IDs correctly.

## Solution - Update Two Nodes

### 1. Update "Prepare Context and Route" Node
This node is at position [-1024, 144] in the workflow.

**Steps:**
1. Open the n8n workflow: `SAXTech MegaMind SAX` (ID: `OrqWQB1kkccRb5Pu`)
2. Find the "Prepare Context and Route" node (it's connected right after the webhook)
3. Open the node editor
4. Replace the entire code with the content from `n8n-voice-fix-complete.js`
5. Save the node

**Key changes:**
- Properly extracts voice data from webhook `voiceSettings` object
- Checks multiple fields: `voiceSettings.selectedVoice`, `voiceSettings.voiceId`, `selectedVoice`, `voiceId`, `voice`
- Passes voice data through in the output object
- Adds logging for debugging

### 2. Update "Format Agent Response" Node
This node is at position [448, 128] in the workflow.

**Steps:**
1. In the same workflow, find the "Format Agent Response" node
2. Open the node editor
3. Replace the entire code with the content from `n8n-format-agent-response-fixed.js`
4. Save the node

**Key changes:**
- Gets voice ID from the passed-through data, not hardcoded
- Uses `originalInput.voiceId` or `originalInput.selectedVoice`
- Passes all voice fields in the output
- Adds logging for debugging

### 3. Apply Same Fix to Other Format Agent Response Nodes
The workflow has multiple Format Agent Response nodes for different agents. Apply the same fix to:
- "Format Agent Response1" at position [-272, 656]
- "Format Agent Response2" at position [-288, 1136]
- "Format Agent Response4" at position [1280, 1024]

Use the same code from `n8n-format-agent-response-fixed.js` for all of them.

## Testing
After applying the fixes:

1. Test with different voice selections in the frontend
2. Check the n8n execution logs for the voice ID being passed
3. Verify the response includes the correct voice ID in metadata
4. The ElevenLabs API should receive the correct voice ID

## Expected Console Output
In the browser console, you should see:
```
Voice selection changed to: gWf6X7X75oO2lF1dH79K
Sending payload to n8n: {voiceSettings: {selectedVoice: 'gWf6X7X75oO2lF1dH79K', ...}}
```

In n8n logs, you should see:
```
===== VOICE DATA EXTRACTION =====
Voice ID received: gWf6X7X75oO2lF1dH79K
Voice Name: Tom
```

And in the response metadata:
```json
{
  "metadata": {
    "voiceConfigured": "gWf6X7X75oO2lF1dH79K",
    "voiceNameConfigured": "Tom"
  }
}
```

## Files Created
- `n8n-voice-fix-complete.js` - Fixed code for "Prepare Context and Route" node
- `n8n-format-agent-response-fixed.js` - Fixed code for "Format Agent Response" nodes
- `FIX-VOICE-INSTRUCTIONS.md` - This instruction file