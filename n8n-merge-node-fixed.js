// N8N CODE NODE: Merge AI Response with ElevenLabs Audio
// This node combines the AI agent response with the TTS audio output
// FIXED to properly handle inputs from both branches

// Get ALL inputs - this will include both Format Agent Response AND ElevenLabs
const allInputs = $input.all();
console.log('=== MERGE AUDIO RESPONSE NODE ===');
console.log('Total inputs received:', allInputs.length);

// Initialize the merged output
let mergedOutput = {};
let aiResponseData = null;
let audioData = null;

// Process each input and identify what it is
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json || allInputs[i];
  console.log(`Input ${i} keys:`, Object.keys(input).slice(0, 15));
  
  // Identify AI Response (has response/text fields)
  if (input.response || input.text || input.output) {
    aiResponseData = input;
    console.log(`Input ${i} identified as AI Response`);
  }
  
  // Identify Audio data (has audioUrl or audioBase64 from ElevenLabs)
  if (input.audioUrl || input.audioBase64 || input.audio) {
    audioData = input;
    console.log(`Input ${i} identified as Audio Data`);
  }
}

// If we only got one input, it might be the AI response without audio
if (allInputs.length === 1 && !audioData) {
  aiResponseData = allInputs[0].json || allInputs[0];
  console.log('Only AI response received (no audio)');
}

// Process AI Response
if (aiResponseData) {
  console.log('AI Response has enableTTS:', aiResponseData.enableTTS);
  console.log('AI Response text preview:', (aiResponseData.response || aiResponseData.text || '').substring(0, 50) + '...');
  
  // Copy all AI response fields
  mergedOutput = { ...aiResponseData };
}

// Process Audio Output (from ElevenLabs)
if (audioData) {
  console.log('Audio data found with keys:', Object.keys(audioData).slice(0, 10));
  
  // Extract audio fields from ElevenLabs output
  if (audioData.audioUrl) {
    console.log('Found audioUrl, length:', audioData.audioUrl.length);
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
    console.log('Found audioBase64, length:', audioData.audioBase64.length);
    mergedOutput.audioBase64 = audioData.audioBase64;
    mergedOutput.audioData = audioData.audioBase64;
    
    // Create data URL if not present
    if (!mergedOutput.audioUrl) {
      mergedOutput.audioUrl = `data:audio/mpeg;base64,${audioData.audioBase64}`;
    }
  }
  
  // Check for audio field
  if (audioData.audio) {
    console.log('Found audio field, length:', audioData.audio.length);
    if (!mergedOutput.audioBase64) {
      mergedOutput.audioBase64 = audioData.audio;
      mergedOutput.audioData = audioData.audio;
    }
    if (!mergedOutput.audioUrl) {
      mergedOutput.audioUrl = `data:audio/mpeg;base64,${audioData.audio}`;
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
  if (mergedOutput.audioUrl || mergedOutput.audioBase64 || mergedOutput.audioData) {
    mergedOutput.audioGenerated = true;
    console.log('Audio data successfully merged');
  }
}

// Final validation and logging
console.log('=== MERGED OUTPUT ===');
console.log('enableTTS:', mergedOutput.enableTTS);
console.log('Has response:', !!mergedOutput.response);
console.log('Has audioUrl:', !!mergedOutput.audioUrl);
console.log('Has audioBase64:', !!mergedOutput.audioBase64);
console.log('Has audioData:', !!mergedOutput.audioData);
console.log('audioGenerated:', mergedOutput.audioGenerated);
console.log('voiceUsed:', mergedOutput.voiceUsed);

// Add timestamp
mergedOutput.mergedAt = new Date().toISOString();

// Ensure we have response fields
if (!mergedOutput.response && mergedOutput.text) {
  mergedOutput.response = mergedOutput.text;
}
if (!mergedOutput.text && mergedOutput.response) {
  mergedOutput.text = mergedOutput.response;
}

// Return the merged output
return [{ json: mergedOutput }];