// N8N CODE NODE: Merge AI Response with ElevenLabs Audio
// This node replaces the problematic Merge node before webhook response
// It combines the AI agent response with the TTS audio output

// Get inputs from both nodes
const aiResponseInput = $input.all(); // From Format Agent Response
const audioInput = $input.all();      // From ElevenLabs TTS

console.log('=== MERGE AUDIO RESPONSE NODE ===');
console.log('AI Response Input count:', aiResponseInput.length);
console.log('Audio Input count:', audioInput.length);

// Initialize the merged output
let mergedOutput = {};

// Process AI Response (should have the text response and metadata)
if (aiResponseInput.length > 0) {
  const aiData = aiResponseInput[0].json;
  console.log('AI Response has enableTTS:', aiData.enableTTS);
  console.log('AI Response text:', aiData.response?.substring(0, 50) + '...');
  
  // Copy all AI response fields
  mergedOutput = { ...aiData };
}

// Process Audio Output (from ElevenLabs)
if (audioInput.length > 0) {
  const audioData = audioInput[0].json;
  console.log('Audio data keys:', Object.keys(audioData));
  
  // Extract audio fields from ElevenLabs output
  if (audioData.audioUrl) {
    console.log('Found audioUrl (base64):', audioData.audioUrl.substring(0, 50) + '...');
    mergedOutput.audioUrl = audioData.audioUrl;
    
    // Extract just the base64 part if it's a data URL
    if (audioData.audioUrl.startsWith('data:audio/')) {
      const base64Part = audioData.audioUrl.split(',')[1];
      mergedOutput.audioBase64 = base64Part;
      mergedOutput.audioData = base64Part; // Duplicate for compatibility
    } else {
      mergedOutput.audioBase64 = audioData.audioUrl;
      mergedOutput.audioData = audioData.audioUrl;
    }
  }
  
  // Also check for audioBase64 field directly
  if (audioData.audioBase64) {
    console.log('Found audioBase64:', audioData.audioBase64.substring(0, 50) + '...');
    mergedOutput.audioBase64 = audioData.audioBase64;
    mergedOutput.audioData = audioData.audioBase64;
    
    // Create data URL if not present
    if (!mergedOutput.audioUrl) {
      mergedOutput.audioUrl = `data:audio/mpeg;base64,${audioData.audioBase64}`;
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
  
  // Ensure TTS flags are set correctly when audio is present
  if (mergedOutput.audioUrl || mergedOutput.audioBase64) {
    mergedOutput.enableTTS = true;
    mergedOutput.ttsEnabled = true;
    mergedOutput.skipTTS = false;
    mergedOutput.audioGenerated = true;
  }
}

// Final validation and logging
console.log('=== MERGED OUTPUT ===');
console.log('enableTTS:', mergedOutput.enableTTS);
console.log('Has audioUrl:', !!mergedOutput.audioUrl);
console.log('Has audioBase64:', !!mergedOutput.audioBase64);
console.log('Has audioData:', !!mergedOutput.audioData);
console.log('audioGenerated:', mergedOutput.audioGenerated);
console.log('voiceUsed:', mergedOutput.voiceUsed);

// Add timestamp
mergedOutput.mergedAt = new Date().toISOString();

// Return the merged output
return [{ json: mergedOutput }];