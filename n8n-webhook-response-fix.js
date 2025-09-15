// Webhook Response Fix - Place this in a Code node right before "Respond to Webhook"
// This ensures we ALWAYS return a valid response even if the AI fails

const inputData = $input.all();
const output = [];

for (const item of inputData) {
    console.log('[Response Fix] Processing response item');
    
    // Extract the AI response from various possible locations
    let aiResponse = '';
    let sessionId = '';
    
    // Try to get the response text
    if (item.text) {
        aiResponse = item.text;
    } else if (item.response) {
        aiResponse = item.response;
    } else if (item.output) {
        aiResponse = item.output;
    } else if (item.message) {
        aiResponse = item.message;
    } else if (item.json?.text) {
        aiResponse = item.json.text;
    } else if (item.json?.response) {
        aiResponse = item.json.response;
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
        console.log('[Response Fix] No AI response found, using fallback');
        
        // Check if it looks like a greeting
        if (originalMessage.toLowerCase().match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))/)) {
            aiResponse = "Hello! How can I assist you today?";
        } 
        // Check if it's a weather request
        else if (originalMessage.toLowerCase().includes('weather')) {
            aiResponse = "I'm having trouble accessing weather information right now. Please try again in a moment.";
        }
        // Generic fallback
        else {
            aiResponse = "I understand you said: \"" + originalMessage + "\". How can I help you with that?";
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
        
        // Audio/TTS fields (empty if not available)
        audio: item.audio || null,
        audioData: item.audioData || null,
        ttsAudio: item.ttsAudio || null,
        
        // Metadata
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (item.startTime || Date.now()),
        
        // HTML formatted response for display
        html: `<div class="ai-response">${aiResponse}</div>`
    };
    
    console.log('[Response Fix] Sending response:', {
        hasResponse: !!responseObject.response,
        responseLength: responseObject.response.length,
        sessionId: responseObject.sessionId
    });
    
    output.push(responseObject);
}

// If no input at all, return a basic error response
if (output.length === 0) {
    console.log('[Response Fix] No input data, returning error response');
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