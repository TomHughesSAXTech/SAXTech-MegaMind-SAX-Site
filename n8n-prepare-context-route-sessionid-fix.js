// FIXED Prepare Context and Route Node - ENSURES sessionId IS ALWAYS OUTPUT
const inputData = $input.all();
const data = inputData[0]?.json || {};

// Check if this is coming from webhook (has body field) or from another node
const isFromWebhook = data.body !== undefined;
const webhookData = isFromWebhook ? data.body : data;

// Check if this is coming from vision processing
const isFromVision = data.visionAnalysis !== undefined || data.imageDescriptions !== undefined;

// Extract core fields - PRIORITIZE sessionId
const sessionId = webhookData.sessionId || data.sessionId || data.originalData?.sessionId || `session_${Date.now()}`;
const message = webhookData.message || webhookData.chatInput || data.chatInput || data.originalMessage || data.message || '';
const attachments = webhookData.attachments || data.attachments || [];
const hasAttachments = attachments && attachments.length > 0;
const attachmentCount = data.attachmentCount || attachments.length || 0;

// Get previous context from frontend
const previousContext = webhookData.previousContext || data.previousContext || {};
const hasExistingContext = previousContext.lastImageAnalysis || previousContext.lastExtractedText || previousContext.lastVisionContent;

// Handle vision and OCR content
let extractedContent = '';
let visionContent = '';

if (isFromVision) {
    extractedContent = data.combinedText || '';
    visionContent = data.visionAnalysis || '';
    console.log('Vision analysis detected');
}

// Build enhanced message with vision and text analysis
let enhancedMessage = message;

// If we have new vision/text content from processing
if (visionContent || extractedContent) {
    const imageContext = attachmentCount > 1 ? `${attachmentCount} images` : 'an image';
    
    enhancedMessage = `${message}

[USER HAS SHARED ${imageContext.toUpperCase()}]

${visionContent ? `VISUAL ANALYSIS:
${visionContent}` : ''}

${extractedContent ? `EXTRACTED TEXT:
${extractedContent}` : ''}

IMPORTANT: The user shared this image and is asking: "${message}"
If the user asks follow-up questions like "what is it?" or "what does this mean?", they are referring to the image content described above.`;
}
// If no new attachments but we have previous context (follow-up question)
else if (!hasAttachments && hasExistingContext) {
    enhancedMessage = `${message}

[CONTEXT FROM PREVIOUS IMAGE/DOCUMENT]

${previousContext.lastVisionContent ? `PREVIOUS VISUAL ANALYSIS:
${previousContext.lastVisionContent}` : ''}

${previousContext.lastExtractedText ? `PREVIOUS EXTRACTED TEXT:
${previousContext.lastExtractedText}` : ''}

${previousContext.lastImageAnalysis ? `PREVIOUS IMAGE DESCRIPTION:
${previousContext.lastImageAnalysis}` : ''}

NOTE: This is a follow-up question about the previously shared ${previousContext.lastAttachmentType || 'content'}. The user is asking: "${message}"`;
}
// Generic follow-up detection without context
else if (!hasAttachments && !isFromVision && message.match(/^(what is it|what's that|explain|tell me more|what does)/i)) {
    enhancedMessage = `${message}

[NOTE: This appears to be a follow-up question. If there was a previous image or context in this conversation, the user is likely referring to that.]`;
}

// Check if this is a search query
const isSearchQuery = checkIfSearchQuery(message);
const searchQuery = isSearchQuery ? extractSearchQuery(message) : null;

// Preserve voice settings
const voiceSettings = {
    voice: webhookData.voice || webhookData.voiceId || data.voice || 'gWf6X7X75oO2lF1dH79K',
    voiceId: webhookData.voiceId || webhookData.voice || data.voiceId || 'gWf6X7X75oO2lF1dH79K',
    voiceName: webhookData.voiceName || data.voiceName || 'Tom',
    selectedVoice: webhookData.selectedVoice || webhookData.voice || data.selectedVoice || 'gWf6X7X75oO2lF1dH79K',
    enableTTS: webhookData.enableTTS !== undefined ? webhookData.enableTTS : (data.enableTTS !== undefined ? data.enableTTS : true),
    ttsSummaryLength: webhookData.ttsSummaryLength || data.ttsSummaryLength || 'short',
    ttsSummarize: webhookData.ttsSummarize !== undefined ? webhookData.ttsSummarize : (data.ttsSummarize !== undefined ? data.ttsSummarize : true)
};

// Helper functions
function checkIfSearchQuery(msg) {
    if (!msg) return false;
    
    const searchPatterns = [
        /search\s+for\s+/i,
        /find\s+.*\s+(document|file|info|information|policy|procedure|sop)/i,
        /look\s+up\s+/i,
        /what\s+is\s+.*\s+(policy|procedure|process)/i,
        /show\s+me\s+.*\s+(document|file|info|information)/i,
        /where\s+can\s+i\s+find/i,
        /do\s+we\s+have\s+.*\s+(document|policy|procedure|info)/i,
        /tell\s+me\s+about\s+.*\s+(policy|procedure|process)/i,
        /how\s+to\s+/i,
        /what\s+are\s+the\s+.*\s+(steps|procedures|requirements)/i,
        /explain\s+.*\s+(policy|procedure|process)/i,
        /get\s+.*\s+(document|file|policy|procedure)/i
    ];
    
    return searchPatterns.some(pattern => pattern.test(msg));
}

function extractSearchQuery(msg) {
    if (!msg) return '';
    
    let query = msg
        .replace(/^(search\s+for|find|look\s+up|show\s+me|tell\s+me\s+about|get)\s+/i, '')
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/\s+(document|file|policy|procedure|sop|information|info)$/i, '')
        .trim();
    
    if (!query || query.length < 3) {
        query = msg;
    }
    
    return query;
}

// Build output - ALWAYS INCLUDE sessionId AT TOP LEVEL
let output = {};

if (isSearchQuery && searchQuery) {
    output = {
        sessionId: sessionId,  // CRITICAL: sessionId at top level
        userMessage: searchQuery,
        searchQuery: searchQuery,
        originalMessage: message,
        chatInput: enhancedMessage,
        ...voiceSettings,
        userProfile: webhookData.userProfile || data.userProfile || {},
        userContext: webhookData.userContext || data.userContext || {},
        personalizedContext: JSON.stringify(webhookData.userProfile || data.userProfile || {}),
        profile: webhookData.profile || data.profile || 'sage',
        user: webhookData.user || data.user || {},
        attachments: attachments,
        hasAttachments: hasAttachments,
        attachmentCount: attachmentCount,
        extractedContent: extractedContent,
        visionAnalysis: visionContent,
        hasVisionContent: isFromVision,
        previousContext: previousContext,
        isSearchRequest: true,
        requiresSearch: true
    };
} else {
    output = {
        sessionId: sessionId,  // CRITICAL: sessionId at top level
        chatInput: enhancedMessage,
        message: message,
        userMessage: message,
        attachments: attachments,
        hasAttachments: hasAttachments,
        attachmentCount: attachmentCount,
        extractedContent: extractedContent,
        visionAnalysis: visionContent,
        hasVisionContent: isFromVision,
        previousContext: previousContext,
        ...voiceSettings,
        userProfile: webhookData.userProfile || data.userProfile || {},
        userContext: webhookData.userContext || data.userContext || {},
        personalizedContext: JSON.stringify(webhookData.userProfile || data.userProfile || {}),
        profile: webhookData.profile || data.profile || 'sage',
        user: webhookData.user || data.user || {},
        isSearchRequest: false,
        requiresSearch: false
    };
}

console.log('Prepare Context output:', {
    sessionId: output.sessionId,  // Log the sessionId to verify
    hasVisionContent: output.hasVisionContent,
    hasChatInput: !!output.chatInput,
    fromVision: isFromVision,
    hasPreviousContext: hasExistingContext,
    message: output.message
});

return output;