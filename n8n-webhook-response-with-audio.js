// WEBHOOK RESPONSE WITH AUDIO - Place this in a Code node right before "Respond to Webhook"
// This ensures we properly forward TTS audio data to the frontend

const inputData = $input.all();
const output = [];

for (const item of inputData) {
    console.log('[Webhook Response] Processing item:', {
        hasResponse: !!item.response,
        hasAudioBase64: !!item.audioBase64,
        hasAudioUrl: !!item.audioUrl,
        hasAudioData: !!item.audioData,
        enableTTS: item.enableTTS,
        ttsEnabled: item.ttsEnabled
    });
    
    // Extract the AI response from various possible locations
    let aiResponse = '';
    let sessionId = '';
    
    // Try to get the response text
    if (item.response) {
        aiResponse = item.response;
    } else if (item.text) {
        aiResponse = item.text;
    } else if (item.output) {
        aiResponse = item.output;
    } else if (item.message) {
        aiResponse = item.message;
    } else if (item.json?.response) {
        aiResponse = item.json.response;
    } else if (item.json?.text) {
        aiResponse = item.json.text;
    }
    
    // Try to get sessionId
    if (item.sessionId) {
        sessionId = item.sessionId;
    } else if (item.json?.sessionId) {
        sessionId = item.json.sessionId;
    } else {
        sessionId = `session_${Date.now()}`;
    }
    
    // Extract original message if available
    const originalMessage = item.chatInput || item.userMessage || item.message || 
                          item.json?.chatInput || item.json?.userMessage || '';
    
    // If no AI response, create a fallback
    if (!aiResponse || aiResponse.trim() === '') {
        console.log('[Webhook Response] No AI response found, using fallback');
        
        // Check if it's a preview request
        if (item.preview) {
            const firstName = item.userProfile?.givenName || item.userProfile?.name?.split(' ')[0] || '';
            aiResponse = firstName ? 
                `Hello ${firstName}! I'm ready to help. How can I assist you today?` :
                "Hello! I'm ready to help. How can I assist you today?";
        }
        // Check if it looks like a greeting
        else if (originalMessage.toLowerCase().match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))/)) {
            aiResponse = "Hello! How can I assist you today?";
        } 
        // Generic fallback
        else {
            aiResponse = originalMessage ? 
                `I understand you said: "${originalMessage}". How can I help you with that?` :
                "I'm ready to help. Please send me your message.";
        }
    }
    
    // Format the response properly for the webhook
    const responseObject = {
        // Main response
        response: aiResponse,
        text: aiResponse,
        message: aiResponse,
        
        // Session management
        sessionId: sessionId,
        
        // Status
        success: true,
        status: 'success',
        
        // Original context
        originalMessage: originalMessage,
        
        // IMPORTANT: Forward ALL audio fields properly
        // The frontend checks for these fields in this order: audioBase64, audioData, audioUrl
        audioBase64: item.audioBase64 || item.audioData || null,
        audioData: item.audioBase64 || item.audioData || null,
        audioUrl: item.audioUrl || null,
        
        // Also include any audio field that might be present
        audio: item.audio || null,
        ttsAudio: item.ttsAudio || null,
        
        // TTS metadata
        enableTTS: item.enableTTS || item.ttsEnabled || false,
        ttsEnabled: item.enableTTS || item.ttsEnabled || false,
        voiceId: item.voiceId || item.voice || null,
        voiceName: item.voiceName || null,
        ttsSkipReason: item.ttsSkipReason || null,
        
        // Vision/OCR results if present
        visionAnalysis: item.visionAnalysis || null,
        extractedText: item.extractedText || null,
        combinedText: item.combinedText || null,
        imageDescription: item.imageDescription || null,
        
        // Metadata
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (item.startTime || Date.now()),
        metadata: item.metadata || {},
        
        // HTML formatted response for display
        html: `<div class="ai-response">${aiResponse}</div>`
    };
    
    console.log('[Webhook Response] Sending response:', {
        hasResponse: !!responseObject.response,
        responseLength: responseObject.response.length,
        sessionId: responseObject.sessionId,
        hasAudioBase64: !!responseObject.audioBase64,
        hasAudioData: !!responseObject.audioData,
        hasAudioUrl: !!responseObject.audioUrl,
        voice: responseObject.voiceId,
        ttsEnabled: responseObject.ttsEnabled
    });
    
    output.push(responseObject);
}

// If no input at all, return a basic error response
if (output.length === 0) {
    console.log('[Webhook Response] No input data, returning error response');
    output.push({
        response: "I'm ready to help. Please send me your message.",
        text: "I'm ready to help. Please send me your message.",
        message: "I'm ready to help. Please send me your message.",
        sessionId: `session_${Date.now()}`,
        success: false,
        status: 'no_input',
        timestamp: new Date().toISOString(),
        html: '<div class="ai-response">I\'m ready to help. Please send me your message.</div>'
    });
}

return output;