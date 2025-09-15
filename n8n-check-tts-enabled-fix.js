// FIX FOR CHECK TTS ENABLED NODE
// This properly checks if TTS is actually enabled
// Place this in the "Check TTS Enabled" IF node or replace with a Code node

const inputData = $input.all();
const output = [];

for (const item of inputData) {
  const data = item.json || item;
  
  // Check multiple fields for TTS status
  // The frontend sends ttsEnabled: false when disabled
  let ttsEnabled = false;
  
  // Check all possible TTS fields
  if (data.ttsEnabled === true || data.enableTTS === true) {
    ttsEnabled = true;
  }
  
  // IMPORTANT: Override if explicitly disabled
  if (data.ttsEnabled === false || data.enableTTS === false) {
    ttsEnabled = false;
  }
  
  // Also check from original request data
  if (data.voiceSettings) {
    if (data.voiceSettings.ttsEnabled === false) {
      ttsEnabled = false;
    } else if (data.voiceSettings.ttsEnabled === true) {
      ttsEnabled = true;
    }
  }
  
  console.log('[Check TTS] TTS Status:', {
    ttsEnabled: ttsEnabled,
    enableTTS: data.enableTTS,
    ttsEnabledField: data.ttsEnabled,
    voiceSettings: data.voiceSettings
  });
  
  // Return the data with the correct TTS status
  output.push({
    ...data,
    ttsEnabled: ttsEnabled,
    enableTTS: ttsEnabled,
    _ttsCheckResult: ttsEnabled
  });
}

// For IF node: Return true/false based on TTS status
// If using this in an IF node, use this expression:
// {{ $json._ttsCheckResult }}

// For routing, you can check:
// If true (TTS enabled) → Handle ElevenLabs Audio
// If false (TTS disabled) → Skip to Merge

return output;