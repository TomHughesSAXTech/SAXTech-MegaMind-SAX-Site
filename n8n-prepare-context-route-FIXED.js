// Fixed Prepare Context and Route - Handles nested input structure properly
const inputData = $input.all();
console.log('[Prepare Context] Starting with input items:', inputData.length);

// Helper function to safely extract nested values
function getNestedValue(obj, ...paths) {
    for (let path of paths) {
        if (!path) continue;
        const keys = path.split('.');
        let value = obj;
        for (let key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                value = undefined;
                break;
            }
        }
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return null;
}

const output = [];

for (const item of inputData) {
    console.log('[Prepare Context] Processing item structure:', Object.keys(item));
    
    // Extract sessionId from multiple possible locations
    const sessionId = getNestedValue(item,
        'sessionId',
        'sessionId_firstItem',
        '_firstItem.sessionId',
        'Prepare_OCR_Data_firstItem.json.sessionId',
        'originalData_firstItem.sessionId',
        '_firstItem.originalData.sessionId'
    ) || `session_${Date.now()}`;
    
    console.log('[Prepare Context] Found sessionId:', sessionId);
    
    // Extract message from multiple possible locations
    const message = getNestedValue(item,
        'message',
        'chatInput',
        'userMessage',
        '_firstItem.message',
        '_firstItem.chatInput',
        '_firstItem.userMessage',
        'Prepare_OCR_Data_firstItem.json.message',
        'Prepare_OCR_Data_firstItem.json.chatInput',
        'originalData_firstItem.message'
    ) || '';
    
    console.log('[Prepare Context] Found message:', message);
    
    // Extract user profile
    const userProfile = getNestedValue(item,
        'userProfile',
        '_firstItem.userProfile',
        'Prepare_OCR_Data_firstItem.json.userProfile',
        'originalData_firstItem.userProfile'
    ) || {};
    
    // Extract user context
    const userContext = getNestedValue(item,
        'userContext',
        '_firstItem.userContext',
        'Prepare_OCR_Data_firstItem.json.userContext',
        'originalData_firstItem.userContext'
    ) || {};
    
    // Extract previous context and conversation history
    const previousContext = getNestedValue(item,
        'previousContext',
        '_firstItem.previousContext',
        'Prepare_OCR_Data_firstItem.json.previousContext',
        'originalData_firstItem.previousContext'
    ) || {};
    
    // Extract voice settings
    const voice = getNestedValue(item,
        'voice',
        'voiceId',
        '_firstItem.voice',
        '_firstItem.voiceId',
        'originalData_firstItem.voice'
    );
    
    const enableTTS = getNestedValue(item,
        'enableTTS',
        '_firstItem.enableTTS',
        'originalData_firstItem.enableTTS'
    ) || false;
    
    // Extract profile
    const profile = getNestedValue(item,
        'profile',
        '_firstItem.profile',
        'originalData_firstItem.profile'
    ) || 'sage';
    
    // Extract attachments info
    const hasAttachments = item.hasAttachments || false;
    const attachments = getNestedValue(item,
        'attachments',
        '_firstItem.attachments',
        'originalData_firstItem.attachments'
    ) || [];
    
    // Extract vision/OCR content if present
    const extractedContent = getNestedValue(item,
        'extractedContent',
        'extractedText',
        '_firstItem.extractedContent'
    ) || '';
    
    const visionAnalysis = getNestedValue(item,
        'visionAnalysis',
        'imageAnalysis',
        '_firstItem.visionAnalysis'
    ) || '';
    
    // Build enhanced message if we have additional context
    let enhancedMessage = message;
    
    if (extractedContent || visionAnalysis) {
        const contextParts = [];
        if (extractedContent) {
            contextParts.push(`Extracted text: ${extractedContent}`);
        }
        if (visionAnalysis) {
            contextParts.push(`Image analysis: ${visionAnalysis}`);
        }
        if (message) {
            contextParts.push(`User message: ${message}`);
        }
        enhancedMessage = contextParts.join('\n\n');
    }
    
    // Add conversation history context if available
    if (previousContext.conversationHistory && previousContext.conversationHistory.length > 0) {
        const recentHistory = previousContext.conversationHistory.slice(-3); // Last 3 exchanges
        const historyContext = recentHistory.map(h => 
            `User: ${h.message}\nAssistant: ${h.response?.replace(/<[^>]*>/g, '').trim()}`
        ).join('\n\n');
        
        if (historyContext && enhancedMessage) {
            enhancedMessage = `Previous conversation:\n${historyContext}\n\nCurrent message: ${enhancedMessage}`;
        }
    }
    
    // Check if this is a search request
    const searchKeywords = ['search', 'find', 'look for', 'looking for', 'where', 'what is', 'how to', 'show me'];
    const isSearchRequest = searchKeywords.some(keyword => 
        message.toLowerCase().includes(keyword)
    );
    
    // Build the output object with all required fields
    const outputItem = {
        // CRITICAL: sessionId at top level for downstream nodes
        sessionId: sessionId,
        
        // Message fields - ensure they're never empty when we have a message
        message: enhancedMessage || message || '',
        chatInput: message || '',
        userMessage: message || '',
        enhancedMessage: enhancedMessage || message || '',
        
        // Attachment data
        attachments: attachments,
        hasAttachments: hasAttachments,
        attachmentCount: attachments.length,
        
        // Extracted content
        extractedContent: extractedContent,
        visionAnalysis: visionAnalysis,
        hasVisionContent: !!(extractedContent || visionAnalysis),
        
        // Context data
        previousContext: previousContext,
        conversationHistory: previousContext.conversationHistory || [],
        
        // Voice settings
        voice: voice,
        voiceId: voice,
        voiceName: getNestedValue(item, 'voiceName', '_firstItem.voiceName'),
        selectedVoice: voice,
        enableTTS: enableTTS,
        ttsSummaryLength: 'short',
        ttsSummarize: true,
        
        // User data
        userProfile: userProfile,
        userContext: userContext,
        personalizedContext: JSON.stringify(userContext),
        profile: profile,
        user: {
            name: userProfile.name || userProfile.givenName || '',
            email: userProfile.email || '',
            ...userProfile
        },
        
        // Search flags
        isSearchRequest: isSearchRequest,
        requiresSearch: isSearchRequest,
        
        // Preserve original structure for debugging
        _debug: {
            hasMessage: !!message,
            messageLength: message.length,
            hasSessionId: !!sessionId,
            inputKeys: Object.keys(item).slice(0, 10), // First 10 keys for debugging
            extractedFrom: {
                message: message ? 'Found' : 'Missing',
                sessionId: sessionId ? 'Found' : 'Missing',
                userProfile: userProfile ? 'Found' : 'Missing'
            }
        }
    };
    
    console.log('[Prepare Context] Output summary:', {
        sessionId: outputItem.sessionId,
        hasMessage: !!outputItem.message,
        messagePreview: outputItem.message.substring(0, 50),
        hasUserProfile: !!outputItem.userProfile.name,
        isSearchRequest: outputItem.isSearchRequest
    });
    
    output.push(outputItem);
}

console.log('[Prepare Context] Returning items:', output.length);
return output;