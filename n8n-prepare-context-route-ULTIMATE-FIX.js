// ULTIMATE FIX - Prepare Context and Route - Handles ALL input variations
const inputData = $input.all();
console.log('[Prepare Context] Starting with input items:', inputData.length);

// Helper function to safely extract nested values with deep path support
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

// Helper to find data anywhere in the object tree
function findDataAnywhere(obj, targetKey, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
        return null;
    }
    
    // Direct check
    if (targetKey in obj && obj[targetKey] !== null && obj[targetKey] !== undefined && obj[targetKey] !== '') {
        return obj[targetKey];
    }
    
    // Recursive search
    for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object') {
            const result = findDataAnywhere(obj[key], targetKey, maxDepth, currentDepth + 1);
            if (result !== null) {
                return result;
            }
        }
    }
    
    return null;
}

const output = [];

for (const item of inputData) {
    console.log('[Prepare Context] Processing item with keys:', Object.keys(item));
    
    // CRITICAL: Check if data is wrapped in 'json' property
    let dataSource = item;
    if (item.json && typeof item.json === 'object') {
        console.log('[Prepare Context] Found json wrapper, unwrapping...');
        dataSource = item.json;
        console.log('[Prepare Context] Json content keys:', Object.keys(dataSource));
    }
    
    // Try to find the actual data in various locations
    const possibleDataSources = [
        dataSource,
        dataSource._firstItem,
        dataSource.originalData,
        dataSource.originalData_firstItem,
        dataSource['Prepare_OCR_Data_firstItem']?.json,
        item._firstItem,
        item.originalData,
        item.originalData_firstItem,
        item['Prepare_OCR_Data_firstItem']?.json
    ].filter(Boolean);
    
    let actualData = dataSource;
    let sessionId = null;
    let message = null;
    let userProfile = null;
    let userContext = null;
    let previousContext = null;
    let voice = null;
    let enableTTS = false;
    
    // Try each possible data source to find our values
    for (const source of possibleDataSources) {
        if (!sessionId) {
            sessionId = getNestedValue(source, 'sessionId') || 
                       findDataAnywhere(source, 'sessionId') ||
                       getNestedValue(source, 'originalData.sessionId');
        }
        
        if (!message) {
            message = getNestedValue(source, 'message', 'chatInput', 'userMessage') ||
                     findDataAnywhere(source, 'message') ||
                     findDataAnywhere(source, 'chatInput') ||
                     findDataAnywhere(source, 'userMessage');
        }
        
        if (!userProfile || Object.keys(userProfile || {}).length === 0) {
            userProfile = getNestedValue(source, 'userProfile') ||
                         findDataAnywhere(source, 'userProfile') ||
                         getNestedValue(source, 'originalData.userProfile');
        }
        
        if (!userContext || Object.keys(userContext || {}).length === 0) {
            userContext = getNestedValue(source, 'userContext') ||
                         findDataAnywhere(source, 'userContext') ||
                         getNestedValue(source, 'originalData.userContext');
        }
        
        if (!previousContext || Object.keys(previousContext || {}).length === 0) {
            previousContext = getNestedValue(source, 'previousContext') ||
                             findDataAnywhere(source, 'previousContext') ||
                             getNestedValue(source, 'originalData.previousContext');
        }
        
        if (!voice) {
            voice = getNestedValue(source, 'voice', 'voiceId', 'selectedVoice') ||
                   findDataAnywhere(source, 'voice') ||
                   findDataAnywhere(source, 'voiceId');
        }
        
        const ttsValue = getNestedValue(source, 'enableTTS') || 
                        findDataAnywhere(source, 'enableTTS');
        if (ttsValue !== null && ttsValue !== undefined) {
            enableTTS = ttsValue;
        }
    }
    
    // Final fallbacks
    sessionId = sessionId || `session_${Date.now()}`;
    message = message || '';
    userProfile = userProfile || {};
    userContext = userContext || {};
    previousContext = previousContext || {};
    
    console.log('[Prepare Context] Extracted data:', {
        sessionId: sessionId,
        messageFound: !!message,
        messageLength: message.length,
        messagePreview: message.substring(0, 30),
        hasUserProfile: !!userProfile.name,
        hasVoice: !!voice,
        enableTTS: enableTTS
    });
    
    // Extract additional fields
    const profile = findDataAnywhere(dataSource, 'profile') || 'sage';
    const attachments = findDataAnywhere(dataSource, 'attachments') || [];
    const hasAttachments = findDataAnywhere(dataSource, 'hasAttachments') || attachments.length > 0;
    const extractedContent = findDataAnywhere(dataSource, 'extractedContent') || 
                            findDataAnywhere(dataSource, 'extractedText') || '';
    const visionAnalysis = findDataAnywhere(dataSource, 'visionAnalysis') || 
                          findDataAnywhere(dataSource, 'imageAnalysis') || '';
    const voiceName = findDataAnywhere(dataSource, 'voiceName') || 
                     (voice === 'gWf6X7X75oO2lF1dH79K' ? 'Tom' : null);
    
    // Build enhanced message with context
    let enhancedMessage = message;
    
    // Add vision/OCR context if available
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
    
    // Add conversation history if available
    if (previousContext.conversationHistory && previousContext.conversationHistory.length > 0) {
        const recentHistory = previousContext.conversationHistory.slice(-2);
        const historyContext = recentHistory.map(h => {
            const cleanResponse = (h.response || '').replace(/<[^>]*>/g, '').trim();
            return `User: ${h.message}\nAssistant: ${cleanResponse.substring(0, 200)}`;
        }).join('\n\n');
        
        if (historyContext && enhancedMessage) {
            enhancedMessage = `Recent conversation:\n${historyContext}\n\nCurrent: ${enhancedMessage}`;
        }
    }
    
    // Check if this is a search request
    const searchKeywords = ['search', 'find', 'look for', 'looking for', 'where', 'what is', 
                          'how to', 'show me', 'weather', 'news', 'stock'];
    const isSearchRequest = message && searchKeywords.some(keyword => 
        message.toLowerCase().includes(keyword)
    );
    
    // Build comprehensive output
    const outputItem = {
        // Session management - CRITICAL
        sessionId: sessionId,
        
        // Message fields - ALL variants to ensure compatibility
        message: enhancedMessage || message,
        chatInput: message,
        userMessage: message,
        enhancedMessage: enhancedMessage || message,
        originalMessage: message,
        
        // Attachment handling
        attachments: attachments,
        hasAttachments: hasAttachments,
        attachmentCount: attachments.length,
        
        // Extracted content
        extractedContent: extractedContent,
        visionAnalysis: visionAnalysis,
        hasVisionContent: !!(extractedContent || visionAnalysis),
        
        // Context preservation
        previousContext: previousContext,
        conversationHistory: previousContext.conversationHistory || [],
        
        // Voice settings - COMPLETE
        voice: voice,
        voiceId: voice,
        voiceName: voiceName,
        selectedVoice: voice,
        enableTTS: enableTTS,
        ttsSummaryLength: 'short',
        ttsSummarize: true,
        ttsEnabled: enableTTS,
        
        // User information
        userProfile: userProfile,
        userContext: userContext,
        personalizedContext: JSON.stringify(userContext),
        profile: profile,
        user: {
            name: userProfile.name || userProfile.givenName || '',
            email: userProfile.email || '',
            jobTitle: userProfile.jobTitle || '',
            department: userProfile.department || '',
            ...userProfile
        },
        
        // Search handling
        isSearchRequest: isSearchRequest,
        requiresSearch: isSearchRequest,
        
        // Complete data passthrough
        originalData: dataSource,
        
        // Debug information
        _debug: {
            hasMessage: !!message,
            messageLength: message.length,
            hasSessionId: !!sessionId,
            inputKeys: Object.keys(item).slice(0, 10),
            dataSourceKeys: Object.keys(dataSource).slice(0, 10),
            extractedFrom: {
                message: message ? 'Found' : 'Missing',
                sessionId: sessionId ? 'Found' : 'Missing',
                userProfile: userProfile.name ? 'Found' : 'Missing',
                voice: voice ? `Found: ${voice}` : 'Missing',
                enableTTS: enableTTS ? 'Enabled' : 'Disabled'
            }
        }
    };
    
    console.log('[Prepare Context] Final output summary:', {
        sessionId: outputItem.sessionId,
        message: outputItem.message.substring(0, 50),
        hasUserProfile: !!outputItem.userProfile.name,
        userName: outputItem.user.name,
        voice: outputItem.voice,
        enableTTS: outputItem.enableTTS,
        isSearchRequest: outputItem.isSearchRequest
    });
    
    output.push(outputItem);
}

console.log('[Prepare Context] Completed. Returning items:', output.length);
return output;