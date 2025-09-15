// Format Agent Response - Fetches voice data from Simple Memory Input node
// This code should go in your n8n Format Agent Response node

// Get the AI response from the current input
const aiResponse = $input.item.json.output || $input.item.json.response || $input.item.json.text || '';

// IMPORTANT: Fetch voice data from the Simple Memory Input node
// You need to replace "Simple Memory Input" with the exact name of your node
let voiceData = {};
try {
  // Try to get data from the Simple Memory Input node
  const memoryNodeData = $items("Simple Memory Input");
  if (memoryNodeData && memoryNodeData.length > 0) {
    voiceData = memoryNodeData[0].json;
  }
} catch (e) {
  // If that fails, try alternative node names
  try {
    const memoryNodeData = $items("simpleMemoryInput");
    if (memoryNodeData && memoryNodeData.length > 0) {
      voiceData = memoryNodeData[0].json;
    }
  } catch (e2) {
    // Log error but continue
    console.log("Could not fetch voice data from Simple Memory Input");
  }
}

// Extract voice configuration
const voice = voiceData.voice || voiceData.voiceId || null;
const voiceName = voiceData.voiceName || null;
const enableTTS = voiceData.enableTTS || voiceData.ttsEnabled || false;
const ttsSummaryLength = voiceData.ttsSummaryLength || 'short';
const ttsSummarize = voiceData.ttsSummarize || false;
const sessionId = voiceData.sessionId || null;
const userProfile = voiceData.userProfile || null;

// Check if the response contains HTML
const hasHtml = /<[^>]+>/.test(aiResponse);

// Strip HTML for TTS
const plainText = aiResponse.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Prepare the formatted output
const formattedOutput = {
  // The main response (with HTML if present)
  response: aiResponse,
  
  // Plain text version for TTS
  text: plainText,
  
  // TTS-specific text
  ttsText: plainText,
  
  // HTML response
  htmlResponse: aiResponse,
  
  // Indicate if HTML is present
  hasHtml: hasHtml,
  
  // Final output
  output: aiResponse,
  
  // CRITICAL: Include voice configuration for TTS node
  voice: voice,
  voiceId: voice,
  voiceName: voiceName,
  selectedVoice: voice,
  enableTTS: enableTTS,
  ttsEnabled: enableTTS,
  ttsSummaryLength: ttsSummaryLength,
  ttsSummarize: ttsSummarize,
  
  // Include session and user data
  sessionId: sessionId,
  userProfile: userProfile
};

// Log for debugging
console.log("Voice configuration in output:", {
  voice: formattedOutput.voice,
  voiceName: formattedOutput.voiceName,
  enableTTS: formattedOutput.enableTTS
});

// Return the formatted output with voice data
return formattedOutput;