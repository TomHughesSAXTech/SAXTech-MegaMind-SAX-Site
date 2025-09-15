// Prepare Context and Route node - SEARCH FIX
// This version sends userMessage field that the search index expects

// Get all input data
const inputData = $input.all();
const webhookData = inputData[0]?.json || {};

// Extract core fields
const message = webhookData.message || webhookData.chatInput || '';
const sessionId = webhookData.sessionId || `session_${Date.now()}`;
const attachments = webhookData.attachments || [];
const hasAttachments = attachments && attachments.length > 0;

// Check if this is a search query
const isSearchQuery = checkIfSearchQuery(message);
const searchQuery = isSearchQuery ? extractSearchQuery(message) : null;

// Preserve voice settings
const voiceSettings = {
    voice: webhookData.voice || webhookData.voiceId || 'gWf6X7X75oO2lF1dH79K',
    voiceId: webhookData.voiceId || webhookData.voice || 'gWf6X7X75oO2lF1dH79K',
    voiceName: webhookData.voiceName || 'Tom',
    selectedVoice: webhookData.selectedVoice || webhookData.voice || 'gWf6X7X75oO2lF1dH79K',
    enableTTS: webhookData.enableTTS !== undefined ? webhookData.enableTTS : true,
    ttsSummaryLength: webhookData.ttsSummaryLength || 'short',
    ttsSummarize: webhookData.ttsSummarize !== undefined ? webhookData.ttsSummarize : true
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
    
    // Remove common prefixes
    let query = msg
        .replace(/^(search\s+for|find|look\s+up|show\s+me|tell\s+me\s+about|get)\s+/i, '')
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/\s+(document|file|policy|procedure|sop|information|info)$/i, '')
        .trim();
    
    // If query is too generic or empty, use the original message
    if (!query || query.length < 3) {
        query = msg;
    }
    
    return query;
}

// Build the output based on whether this is a search query or regular chat
let output = {};

if (isSearchQuery && searchQuery) {
    // Route to search index
    console.log(`Routing to search index with query: "${searchQuery}"`);
    
    output = {
        // CRITICAL: Search index looks for userMessage field!
        userMessage: searchQuery,
        
        // Also keep these for compatibility
        searchQuery: searchQuery,
        originalMessage: message,
        sessionId: sessionId,
        
        // Also include chatInput for AI agent to use search results
        chatInput: message,
        
        // Preserve all other data
        ...voiceSettings,
        userProfile: webhookData.userProfile || {},
        userContext: webhookData.userContext || {},
        profile: webhookData.profile || 'sage',
        user: webhookData.user || {},
        
        // Flag for downstream nodes
        isSearchRequest: true,
        requiresSearch: true
    };
} else {
    // Regular chat flow
    console.log('Processing as regular chat message');
    
    // Process any attachments
    let extractedContent = webhookData.extractedContent || '';
    if (hasAttachments) {
        console.log(`Processing ${attachments.length} attachments`);
        
        // Build context about attachments for the AI
        const attachmentContext = attachments.map((att, idx) => {
            if (att.isScreenshot) {
                return `[Screenshot ${idx + 1}: ${att.name} - awaiting OCR processing]`;
            } else if (att.type && att.type.includes('image')) {
                return `[Image ${idx + 1}: ${att.name} - awaiting OCR processing]`;
            } else {
                return `[File ${idx + 1}: ${att.name} (${att.type}) - awaiting content extraction]`;
            }
        }).join('\n');
        
        extractedContent = attachmentContext;
    }
    
    // Build the chat input
    let chatInput = message;
    if (extractedContent) {
        chatInput = `${message}\n\nAttached Content:\n${extractedContent}`;
    }
    
    output = {
        // Core chat fields
        chatInput: chatInput,
        message: message,
        sessionId: sessionId,
        
        // ALSO include userMessage for compatibility with search that might run later
        userMessage: message,
        
        // Attachment data
        attachments: attachments,
        hasAttachments: hasAttachments,
        extractedContent: extractedContent,
        
        // Voice settings
        ...voiceSettings,
        
        // User context
        userProfile: webhookData.userProfile || {},
        userContext: webhookData.userContext || {},
        profile: webhookData.profile || 'sage',
        user: webhookData.user || {},
        
        // Flags
        isSearchRequest: false,
        requiresSearch: false
    };
}

// Log what we're outputting
console.log('Output summary:', {
    hasSearchQuery: isSearchQuery,
    searchQuery: searchQuery,
    hasUserMessage: !!output.userMessage,
    userMessage: output.userMessage,
    hasChatInput: !!output.chatInput,
    hasAttachments: hasAttachments,
    attachmentCount: attachments.length,
    sessionId: output.sessionId,
    voiceEnabled: output.enableTTS
});

// Return the processed data
return output;