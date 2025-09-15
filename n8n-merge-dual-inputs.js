// N8N CODE NODE: Merge AI Response with ElevenLabs Audio (Dual Input Handler)
// This node receives inputs from two different nodes and merges them
// Input 0: Format Agent Response (AI text response)
// Input 1: ElevenLabs TTS (Audio output)

// Get inputs from both source nodes
const inputs = $input.all();
console.log('=== MERGE DUAL INPUTS NODE ===');
console.log('Total inputs received:', inputs.length);

// Since this is configured to receive from 2 nodes, we need to handle them separately
// In n8n, when a Code node has multiple input connections, they come as separate arrays
const aiResponseData = inputs[0]?.json || {};
const audioData = inputs[1]?.json || inputs[0]?.json || {}; // Fallback if only one input

console.log('Input 0 keys:', Object.keys(aiResponseData).slice(0, 10));
console.log('Input 1 keys (audio expected):', Object.keys(audioData).slice(0, 10));

// Start with the AI response as base
let mergedOutput = { ...aiResponseData };

// Check if audioData actually has audio fields
const hasAudioUrl = audioData.audioUrl || audioData.audioBase64 || audioData.audioData;
console.log('Audio data has audio fields:', !!hasAudioUrl);

if (hasAudioUrl) {
  // This is the audio output from ElevenLabs
  console.log('Processing ElevenLabs audio output...');
  
  // Handle audioUrl (might be a data URL)
  if (audioData.audioUrl) {
    console.log('Found audioUrl:', audioData.audioUrl.substring(0, 60) + '...');
    mergedOutput.audioUrl = audioData.audioUrl;
    
    // Extract base64 if it's a data URL
    if (audioData.audioUrl.startsWith('data:audio/')) {
      const base64Part = audioData.audioUrl.split(',')[1];
      if (base64Part) {
        mergedOutput.audioBase64 = base64Part;
        mergedOutput.audioData = base64Part;
      }
    }
  }
  
  // Handle direct audioBase64
  if (audioData.audioBase64 && !mergedOutput.audioBase64) {
    console.log('Found audioBase64 directly');
    mergedOutput.audioBase64 = audioData.audioBase64;
    mergedOutput.audioData = audioData.audioBase64;
    
    // Create audioUrl if missing
    if (!mergedOutput.audioUrl) {
      mergedOutput.audioUrl = `data:audio/mpeg;base64,${audioData.audioBase64}`;
    }
  }
  
  // Handle audioData field
  if (audioData.audioData && !mergedOutput.audioData) {
    console.log('Found audioData field');
    mergedOutput.audioData = audioData.audioData;
    
    // Ensure other fields are populated
    if (!mergedOutput.audioBase64) {
      mergedOutput.audioBase64 = audioData.audioData;
    }
    if (!mergedOutput.audioUrl) {
      mergedOutput.audioUrl = `data:audio/mpeg;base64,${audioData.audioData}`;
    }
  }
  
  // Copy audio metadata
  if (audioData.audioGenerated !== undefined) {
    mergedOutput.audioGenerated = audioData.audioGenerated;
  }
  if (audioData.voiceUsed) {
    mergedOutput.voiceUsed = audioData.voiceUsed;
  }
  if (audioData.textLength !== undefined) {
    mergedOutput.textLength = audioData.textLength;
  }
  if (audioData.timestamp) {
    mergedOutput.audioTimestamp = audioData.timestamp;
  }
  
  // Override TTS settings when audio is present
  mergedOutput.enableTTS = true;
  mergedOutput.ttsEnabled = true;
  mergedOutput.skipTTS = false;
  mergedOutput.audioGenerated = true;
  
} else if (audioData.response && audioData.enableTTS) {
  // This might be a duplicate of AI response, check if it has unique audio fields
  console.log('Checking for embedded audio in response data...');
  
  // Sometimes ElevenLabs output might be embedded in the response
  if (audioData.audioUrl || audioData.audioBase64 || audioData.audioData) {
    // Found audio fields in what looked like response data
    mergedOutput = { ...mergedOutput, ...audioData };
  }
}

// Ensure response text is present
if (!mergedOutput.response && aiResponseData.response) {
  mergedOutput.response = aiResponseData.response;
}
if (!mergedOutput.response && audioData.response) {
  mergedOutput.response = audioData.response;
}

// Preserve user profile
if (!mergedOutput.userProfile && aiResponseData.userProfile) {
  mergedOutput.userProfile = aiResponseData.userProfile;
}
if (!mergedOutput.userProfile && audioData.userProfile) {
  mergedOutput.userProfile = audioData.userProfile;
}

// Final validation
const hasAudio = !!(mergedOutput.audioUrl || mergedOutput.audioBase64 || mergedOutput.audioData);
console.log('=== FINAL MERGED OUTPUT ===');
console.log('Has response text:', !!mergedOutput.response);
console.log('Has audio (any format):', hasAudio);
console.log('enableTTS:', mergedOutput.enableTTS);
console.log('audioGenerated:', mergedOutput.audioGenerated);
console.log('Voice used:', mergedOutput.voiceUsed || mergedOutput.voiceName);

// Add merge metadata
mergedOutput.mergedAt = new Date().toISOString();
mergedOutput.audioPresent = hasAudio;

// Return the merged result
return [{ json: mergedOutput }];