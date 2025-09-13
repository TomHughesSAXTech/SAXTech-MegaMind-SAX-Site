// Format Agent Response Node - FIXED to pass voice data through
// This node formats the AI response AND preserves voice settings for TTS

// Get the AI agent output
const agentOutput = $json;

// CRITICAL: Get the original webhook input to preserve voice settings
// This needs to reference the correct webhook node name from your workflow
const webhookData = $items("MegaMind SAX SAGE Webhook")[0].json.body || 
                   $items("MegaMind SAX SAGE Webhook")[0].json;

// Extract voice settings from the original request
const voiceId = webhookData.voice || 
               webhookData.voiceId || 
               webhookData.selectedVoice || 
               'EXAVITQu4vr4xnSDxMaL'; // Rachel as default

const voiceName = webhookData.voiceName || 'Rachel';
const enableTTS = webhookData.enableTTS !== false;
const ttsSummarize = webhookData.ttsSummarize === true;
const ttsSummaryLength = webhookData.ttsSummaryLength || 'short';
const sessionId = webhookData.sessionId || 'default';

// Debug logging
console.log('Format Agent Response - Voice settings:', {
    voiceId: voiceId,
    voiceName: voiceName,
    enableTTS: enableTTS,
    webhookVoice: webhookData.voice,
    webhookVoiceId: webhookData.voiceId,
    webhookSelectedVoice: webhookData.selectedVoice
});

// Extract the actual response text from various possible fields
let responseText = '';
if (typeof agentOutput.output === 'string') {
    responseText = agentOutput.output;
} else if (typeof agentOutput.text === 'string') {
    responseText = agentOutput.text;
} else if (typeof agentOutput.result === 'string') {
    responseText = agentOutput.result;
} else if (typeof agentOutput.response === 'string') {
    responseText = agentOutput.response;
} else {
    responseText = 'I apologize, but I was unable to generate a proper response.';
}

// Prepare TTS text if enabled
let ttsText = responseText;
if (enableTTS && ttsSummarize && responseText.length > 500) {
    // Clean HTML for TTS
    let cleanText = responseText.replace(/<[^>]*>/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
    
    // Extract first few sentences for TTS
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    if (ttsSummaryLength === 'short') {
        ttsText = sentences.slice(0, 2).join(' ');
    } else {
        ttsText = sentences.slice(0, 4).join(' ');
    }
    
    // Add continuation notice if truncated
    if (sentences.length > 4) {
        ttsText += ' I have more information available if you need it.';
    }
}

// IMPORTANT: Pass ALL data through including voice settings
return [{
    json: {
        // The actual response
        response: responseText,
        
        // TTS text (may be shortened version)
        ttsText: ttsText,
        
        // CRITICAL: Pass voice settings for the ElevenLabs node
        voice: voiceId,           // Primary voice ID field
        voiceId: voiceId,         // Alternative field
        selectedVoice: voiceId,   // Legacy field
        voiceName: voiceName,     // Display name
        
        // TTS control flags
        enableTTS: enableTTS,
        ttsSummarize: ttsSummarize,
        ttsSummaryLength: ttsSummaryLength,
        
        // Session data
        sessionId: sessionId,
        
        // Metadata
        timestamp: new Date().toISOString(),
        metadata: {
            agentType: 'SAXTech MegaMind',
            responseLength: responseText.length,
            ttsTextLength: ttsText.length,
            voiceConfigured: voiceId
        }
    }
}];