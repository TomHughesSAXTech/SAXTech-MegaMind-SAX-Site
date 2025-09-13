// =====================================
// N8N CODE NODE - COMPLETE VOICE & TTS FIX
// Place this AFTER your AI response node and BEFORE ElevenLabs
// =====================================

// Get inputs from webhook and AI response
const webhookData = $input.first().json;
const aiResponse = items[0].json.response || items[0].json.text || '';

// Extract voice selection from webhook
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
let ttsText = aiResponse;
let fullResponse = aiResponse;

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
else if (enableTTS && ttsSummaryLength === 'short' && aiResponse.length > 150) {
  // Split into sentences
  const sentences = aiResponse.match(/[^.!?]+[.!?]+/g) || [aiResponse];
  
  // Create a short summary (5-10 seconds of speech)
  if (sentences.length > 3) {
    // Take first 2 sentences and add a note
    ttsText = sentences.slice(0, 2).join(' ').trim() + 
              " I've provided more details in the text response.";
  } else if (aiResponse.length > 200) {
    // Find a good break point
    let cutoff = aiResponse.substring(0, 150).lastIndexOf('. ');
    if (cutoff === -1) cutoff = aiResponse.substring(0, 150).lastIndexOf(' ');
    if (cutoff === -1) cutoff = 150;
    
    ttsText = aiResponse.substring(0, cutoff).trim() + 
              "... Please see the full response in the text.";
  }
  // Response is already short enough
  else {
    ttsText = aiResponse;
  }
}

// Log for debugging
console.log('TTS Processing:', {
  selectedVoice: selectedVoice,
  voiceId: voiceId,
  enableTTS: enableTTS,
  ttsSummaryLength: ttsSummaryLength,
  isPreview: isPreview,
  originalLength: aiResponse.length,
  ttsLength: ttsText.length
});

// Return the processed data
return {
  // For display in chat
  response: fullResponse,
  
  // For ElevenLabs TTS
  ttsText: enableTTS ? ttsText : '',
  voiceId: voiceId,
  selectedVoice: selectedVoice,
  
  // Control flags
  enableTTS: enableTTS,
  skipTTS: !enableTTS || !ttsText,
  
  // Original webhook data (pass through)
  webhookData: webhookData,
  
  // Metadata
  processingInfo: {
    voiceUsed: selectedVoice,
    voiceIdUsed: voiceId,
    ttsEnabled: enableTTS,
    ttsSummaryApplied: ttsSummaryLength === 'short' && aiResponse.length > 150,
    isPreview: isPreview
  }
};