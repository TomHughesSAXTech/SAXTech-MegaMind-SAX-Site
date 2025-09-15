// Complete Session and Voice Fix
// Place this AFTER the AI Agent and BEFORE the Respond to Webhook node
// This ensures sessionId and voice settings are preserved

const inputData = $input.all();
const output = [];

for (const item of inputData) {
    console.log('[Session/Voice Fix] Processing item');
    
    // Find the original request data by looking through the workflow
    // This searches for the original webhook data that contains user settings
    const workflowData = $items();
    let originalSessionId = null;
    let originalVoiceId = null;
    let originalVoiceName = null;
    let originalEnableTTS = false;
    let originalMessage = '';
    
    // Search through all workflow items for original data
    for (const workflowItem of workflowData) {
        // Check for sessionId
        if (!originalSessionId && workflowItem.json) {
            if (workflowItem.json.sessionId && workflowItem.json.sessionId !== 'default') {
                originalSessionId = workflowItem.json.sessionId;
            } else if (workflowItem.json.originalData?.sessionId) {
                originalSessionId = workflowItem.json.originalData.sessionId;
            }
        }
        
        // Check for voice settings
        if (!originalVoiceId && workflowItem.json) {
            // Look for Tom's voice ID specifically
            if (workflowItem.json.voice === 'gWf6X7X75oO2lF1dH79K' || 
                workflowItem.json.voiceId === 'gWf6X7X75oO2lF1dH79K' ||
                workflowItem.json.selectedVoice === 'gWf6X7X75oO2lF1dH79K') {
                originalVoiceId = 'gWf6X7X75oO2lF1dH79K';
                originalVoiceName = 'Tom';
            } else if (workflowItem.json.voice || workflowItem.json.voiceId) {
                originalVoiceId = workflowItem.json.voice || workflowItem.json.voiceId;
                originalVoiceName = workflowItem.json.voiceName || null;
            }
        }
        
        // Check for TTS settings
        if (workflowItem.json?.enableTTS !== undefined) {
            originalEnableTTS = workflowItem.json.enableTTS;
        }
        
        // Get original message
        if (!originalMessage && workflowItem.json) {
            originalMessage = workflowItem.json.message || 
                            workflowItem.json.chatInput || 
                            workflowItem.json.userMessage || '';
        }
    }
    
    // If we still don't have a sessionId, try to extract from the current item
    if (!originalSessionId) {
        // Try various locations
        originalSessionId = item.sessionId || 
                          item.json?.sessionId || 
                          item.metadata?.sessionId ||
                          `session_${Date.now()}`;
    }
    
    // Get the AI response
    const aiResponse = item.response || item.text || item.output || item.message || '';
    
    console.log('[Session/Voice Fix] Found settings:', {
        sessionId: originalSessionId,
        voiceId: originalVoiceId,
        voiceName: originalVoiceName,
        enableTTS: originalEnableTTS,
        hasResponse: !!aiResponse
    });
    
    // Build the corrected output
    const outputItem = {
        // Preserve the AI response
        response: aiResponse,
        text: aiResponse,
        ttsText: aiResponse,
        
        // CRITICAL: Use the ORIGINAL session ID, not "default"
        sessionId: originalSessionId || `session_${Date.now()}`,
        
        // CRITICAL: Use the ORIGINAL voice settings
        selectedVoice: originalVoiceId || 'gWf6X7X75oO2lF1dH79K',  // Default to Tom
        voiceId: originalVoiceId || 'gWf6X7X75oO2lF1dH79K',
        voiceName: originalVoiceName || 'Tom',
        voice: originalVoiceId || 'gWf6X7X75oO2lF1dH79K',
        
        // TTS settings
        enableTTS: originalEnableTTS,
        ttsEnabled: originalEnableTTS,
        ttsSummaryApplied: item.ttsSummaryApplied || false,
        
        // Other fields
        preview: item.preview || false,
        timestamp: item.timestamp || new Date().toISOString(),
        
        // Original message for context
        originalMessage: originalMessage,
        
        // Preserve existing metadata but update voice info
        metadata: {
            ...(item.metadata || {}),
            agentType: item.metadata?.agentType || 'SAXTech MegaMind SAX Assistant',
            responseLength: aiResponse.length,
            ttsLength: aiResponse.length,
            voiceConfigured: originalVoiceId || 'gWf6X7X75oO2lF1dH79K',
            voiceNameConfigured: originalVoiceName || 'Tom',
            sessionIdUsed: originalSessionId,
            debugInfo: {
                ...(item.metadata?.debugInfo || {}),
                fixApplied: true,
                originalSessionId: originalSessionId,
                originalVoiceId: originalVoiceId,
                voiceSource: originalVoiceId ? 'user_settings' : 'default'
            }
        }
    };
    
    output.push(outputItem);
}

console.log('[Session/Voice Fix] Returning corrected data');
return output;