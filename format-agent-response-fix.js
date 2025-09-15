// Format Agent Response - Fixed to preserve voice data
// This code should go in your n8n Format Agent Response node

// Get the AI response
const aiResponse = $input.item.json.output || $input.item.json.response || $input.item.json.text || '';

// Get the voice configuration from Simple Memory Input
// Look for it in the current item or in previous nodes
const voiceData = $item(0, "simpleMemoryInput")?.json || $input.item.json;
const voice = voiceData.voice || voiceData.voiceId;
const voiceName = voiceData.voiceName;
const enableTTS = voiceData.enableTTS || voiceData.ttsEnabled;
const ttsSummaryLength = voiceData.ttsSummaryLength;
const ttsSummarize = voiceData.ttsSummarize;

// Check if the response contains HTML
const hasHtml = /<[^>]+>/.test(aiResponse);

// Prepare the formatted output
const formattedOutput = {
  // The main response (with HTML if present)
  response: aiResponse,
  
  // Plain text version for TTS (strip HTML tags)
  text: aiResponse.replace(/<[^>]+>/g, '').trim(),
  
  // TTS-specific text (can be shortened or modified for speech)
  ttsText: aiResponse.replace(/<[^>]+>/g, '').trim(),
  
  // HTML response (same as response if it contains HTML)
  htmlResponse: hasHtml ? aiResponse : aiResponse,
  
  // Indicate if HTML is present
  hasHtml: hasHtml,
  
  // Final output
  output: aiResponse,
  
  // IMPORTANT: Preserve voice configuration
  voice: voice,
  voiceId: voice,
  voiceName: voiceName,
  enableTTS: enableTTS,
  ttsSummaryLength: ttsSummaryLength,
  ttsSummarize: ttsSummarize,
  
  // Also preserve session and user data if needed
  sessionId: voiceData.sessionId,
  userProfile: voiceData.userProfile
};

// Return the formatted output with preserved voice data
return formattedOutput;