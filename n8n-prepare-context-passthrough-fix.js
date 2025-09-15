// FIXED Prepare Context and Route Node
// This version properly passes through data without overwriting

const inputData = $input.all();
const data = inputData[0]?.json || {};

// Check if this is coming from webhook (has body field) or from another node
const isFromWebhook = data.body !== undefined;
const webhookData = isFromWebhook ? data.body : data;

// Extract core fields - use existing values if already processed
const message = webhookData.message || webhookData.chatInput || data.chatInput || '';
const sessionId = webhookData.sessionId || data.sessionId || `session_${Date.now()}`;
const attachments = webhookData.attachments || data.attachments || [];
const hasAttachments = attachments && attachments.length > 0;

// If data has already been processed (has extractedContent), just pass it through
if (data.extractedContent || data.processedAttachments) {
    console.log('Data already processed, passing through');
    return data;
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

// Helper function to check if message is a search query
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

// Helper function to extract search query from message
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

// Build output
let output = {};

if (isSearchQuery && searchQuery) {
    // Route to search index
    console.log(`Routing to search with query: "${searchQuery}"`);
    
    output = {
        // For search index node
        userMessage: searchQuery,
        searchQuery: searchQuery,
        originalMessage: message,
        sessionId: sessionId,
        chatInput: message,
        
        // Preserve all other data
        ...voiceSettings,
        userProfile: webhookData.userProfile || data.userProfile || {},
        userContext: webhookData.userContext || data.userContext || {},
        profile: webhookData.profile || data.profile || 'sage',
        user: webhookData.user || data.user || {},
        
        // Attachments (if any)
        attachments: attachments,
        hasAttachments: hasAttachments,
        
        // Flags
        isSearchRequest: true,
        requiresSearch: true
    };
} else {
    // Regular chat flow - preserve everything
    console.log('Processing as regular chat');
    
    output = {
        // Core fields
        chatInput: message,
        message: message,
        sessionId: sessionId,
        userMessage: message, // For compatibility
        
        // Attachment data
        attachments: attachments,
        hasAttachments: hasAttachments,
        extractedContent: webhookData.extractedContent || data.extractedContent || '',
        
        // Voice settings
        ...voiceSettings,
        
        // User context
        userProfile: webhookData.userProfile || data.userProfile || {},
        userContext: webhookData.userContext || data.userContext || {},
        profile: webhookData.profile || data.profile || 'sage',
        user: webhookData.user || data.user || {},
        
        // Flags
        isSearchRequest: false,
        requiresSearch: false
    };
}

// Log what we're outputting
console.log('Prepare Context output:', {
    hasSearchQuery: isSearchQuery,
    searchQuery: searchQuery,
    hasChatInput: !!output.chatInput,
    hasAttachments: hasAttachments,
    attachmentCount: attachments.length,
    sessionId: output.sessionId,
    voiceEnabled: output.enableTTS,
    fromWebhook: isFromWebhook
});

return output;