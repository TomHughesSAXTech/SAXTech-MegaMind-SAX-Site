// =====================================
// FORMAT AGENT RESPONSE CODE NODE
// This replaces your existing "Format Agent Response Code" node
// =====================================

// Get the agent response and webhook data
const agentResponse = $input.first().json.response || $input.first().json.text || '';
const webhookData = $('Webhook').first().json;

// Extract voice selection and TTS settings from webhook
const selectedVoice = webhookData.selectedVoice || webhookData.voice || 'sarah';
const enableTTS = webhookData.enableTTS || false;
const ttsSummaryLength = webhookData.ttsSummaryLength || 'normal';
const isPreview = webhookData.preview === true;

// Voice mapping for ElevenLabs
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',      // Sarah - Female Professional
  'daniel': 'onwK4e9ZLuTAKqWW03F9',     // Daniel - Male Professional  
  'emily': 'LcfcDJNUP1GQjkzn1xUU',      // Emily - British Female
  'james': 'IKne3meq5aSn9XLyUdCD',      // James - Deep Male
  'charlotte': 'XB0fDUnXU5powFXDhCwa'   // Charlotte - Energetic Female
};

// Get the correct voice ID
const voiceId = voiceMap[selectedVoice.toLowerCase()] || voiceMap['sarah'];

// Prepare TTS text
let ttsText = agentResponse;
let fullResponse = agentResponse;

// Handle preview mode - short greeting
if (isPreview) {
  const firstName = webhookData.userProfile?.givenName || 
                   webhookData.userProfile?.name?.split(' ')[0] || '';
  
  ttsText = firstName 
    ? `Hello ${firstName}! I'm ready to help. What can I do for you today?`
    : "Hello! I'm ready to assist you. What can I do for you today?";
  
  fullResponse = ttsText; // For preview, text and TTS are the same
}
// Handle regular messages with short TTS summary
else if (enableTTS && ttsSummaryLength === 'short' && agentResponse.length > 150) {
  // Split into sentences
  const sentences = agentResponse.match(/[^.!?]+[.!?]+/g) || [agentResponse];
  
  // Create a short summary (5-10 seconds of speech = ~75-150 words = ~150-300 chars)
  if (sentences.length > 3) {
    // Take first 2 sentences and add a note
    ttsText = sentences.slice(0, 2).join(' ').trim();
    // Only add suffix if we actually truncated
    if (ttsText.length < agentResponse.length * 0.5) {
      ttsText += " I've provided more details in the text response.";
    }
  } else if (agentResponse.length > 200) {
    // Find a good break point
    let cutoff = agentResponse.substring(0, 150).lastIndexOf('. ');
    if (cutoff === -1) cutoff = agentResponse.substring(0, 150).lastIndexOf(' ');
    if (cutoff === -1) cutoff = 150;
    
    ttsText = agentResponse.substring(0, cutoff).trim() + 
              "... Please see the full response in the text.";
  }
  // Response is already short enough - use as is
}

// Log for debugging
console.log('Format Agent Response:', {
  selectedVoice: selectedVoice,
  voiceId: voiceId,
  enableTTS: enableTTS,
  ttsSummaryLength: ttsSummaryLength,
  isPreview: isPreview,
  originalLength: agentResponse.length,
  ttsLength: ttsText.length,
  ttsTruncated: ttsText.length < agentResponse.length
});

// Return the formatted data
return {
  // Full text for display
  response: fullResponse,
  
  // Text for TTS (might be shortened)
  ttsText: enableTTS ? ttsText : '',
  
  // Voice selection
  voiceId: voiceId,
  selectedVoice: selectedVoice,
  
  // Control flags
  enableTTS: enableTTS,
  skipTTS: !enableTTS || !ttsText,
  
  // Pass through webhook data
  webhookData: webhookData,
  
  // Metadata for debugging
  processingInfo: {
    voiceUsed: selectedVoice,
    voiceIdUsed: voiceId,
    ttsEnabled: enableTTS,
    ttsSummaryApplied: ttsSummaryLength === 'short' && agentResponse.length > 150,
    isPreview: isPreview,
    textWasTruncated: ttsText.length < agentResponse.length
  }
};