// Diagnostic Node - Place this BEFORE the AI Agent node
// This will show you exactly what data is being passed

const inputData = $input.all();
const data = inputData[0]?.json || {};

// Log all important fields
console.log('=== DIAGNOSTIC OUTPUT ===');
console.log('1. Chat Input:', data.chatInput ? `"${data.chatInput.substring(0, 200)}..."` : 'MISSING');
console.log('2. Message:', data.message || 'MISSING');
console.log('3. Session ID:', data.sessionId || 'MISSING');
console.log('4. Attachments:', data.attachments ? data.attachments.length : 'NONE');
console.log('5. Extracted Content:', data.extractedContent ? `${data.extractedContent.length} chars` : 'NONE');
console.log('6. User Message (for search):', data.userMessage || 'MISSING');
console.log('7. Voice Settings:', {
    voice: data.voice || 'MISSING',
    voiceId: data.voiceId || 'MISSING',
    enableTTS: data.enableTTS
});

// Check if this came through attachment processor
if (data.processedAttachments) {
    console.log('8. Processed Attachments:', data.processedAttachments);
}

// Check if this is a search request
if (data.isSearchRequest) {
    console.log('9. Search Request:', {
        searchQuery: data.searchQuery,
        requiresSearch: data.requiresSearch
    });
}

// Show all field names present
console.log('10. All fields present:', Object.keys(data));

// CRITICAL: Make sure chatInput exists for AI Agent
if (!data.chatInput) {
    console.warn('⚠️ WARNING: chatInput is missing! AI Agent will fail!');
    // Create chatInput from message if missing
    data.chatInput = data.message || data.userMessage || 'Hello';
}

console.log('=== END DIAGNOSTIC ===');

// Pass everything through unchanged
return data;