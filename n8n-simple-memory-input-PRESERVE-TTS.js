// SIMPLE MEMORY INPUT FIX - PRESERVE TTS SETTINGS
// This node prepares input for the memory system while PRESERVING TTS settings

const input = $input.first().json;

console.log('[Simple Memory Input] Incoming data:', {
  hasSessionId: !!input.sessionId,
  hasChatInput: !!input.chatInput || !!input.message,
  hasEnableTTS: input.enableTTS !== undefined,
  hasVoiceId: !!input.voiceId,
  hasVoiceName: !!input.voiceName,
  enableTTSValue: input.enableTTS,
  voiceIdValue: input.voiceId
});

// Extract the message
const message = input.chatInput || input.message || input.userMessage || input.enhancedMessage || '';

// Build the output with ALL necessary fields preserved
const output = {
  // CRITICAL: Session and message for memory
  sessionId: input.sessionId || `session_${Date.now()}`,
  chatInput: message,
  
  // CRITICAL: PRESERVE ALL TTS SETTINGS
  enableTTS: input.enableTTS || false,
  ttsEnabled: input.ttsEnabled || input.enableTTS || false,
  voice: input.voice || input.selectedVoice || 'sarah',
  voiceId: input.voiceId || '',
  voiceName: input.voiceName || '',
  selectedVoice: input.selectedVoice || input.voice || 'sarah',
  ttsSummaryLength: input.ttsSummaryLength || 'normal',
  ttsSummarize: input.ttsSummarize || false,
  
  // Preserve user profile for personalization
  userProfile: input.userProfile || {},
  
  // Preserve other context that might be needed
  preview: input.preview || false,
  profile: input.profile || 'default',
  
  // Add conversation history if available
  conversationHistory: input.conversationHistory || [],
  previousContext: input.previousContext || {},
  
  // Pass through the original data in case it's needed
  _originalData: {
    hasAttachments: input.hasAttachments,
    attachments: input.attachments,
    extractedContent: input.extractedContent,
    visionAnalysis: input.visionAnalysis
  }
};

console.log('[Simple Memory Input] Output being sent:', {
  sessionId: output.sessionId,
  messageLength: output.chatInput.length,
  enableTTS: output.enableTTS,
  voiceId: output.voiceId,
  voiceName: output.voiceName,
  hasUserProfile: !!output.userProfile.name
});

return [output];