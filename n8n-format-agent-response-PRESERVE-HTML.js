// N8N CODE NODE: Format Agent Response - PRESERVE HTML VERSION
// This node formats the AI agent response while preserving HTML formatting
// It handles both HTML and plain text responses intelligently

// Get inputs
const inputs = $input.all();
console.log('=== FORMAT AGENT RESPONSE (HTML PRESERVED) ===');
console.log('Number of inputs:', inputs.length);

// Initialize output
let output = {
    response: '',
    text: '',
    ttsText: '',
    htmlResponse: '',
    hasHtml: false,
    metadata: {
        source: 'Format Agent Response',
        timestamp: new Date().toISOString(),
        responseType: 'normal',
        inputsProcessed: inputs.length
    }
};

// Process first input (should be AI agent response)
if (inputs.length > 0) {
    const aiResponse = inputs[0].json;
    console.log('Processing AI response...');
    
    // Get the raw response
    let rawResponse = '';
    
    // Check different possible response fields
    if (aiResponse.output) {
        rawResponse = aiResponse.output;
    } else if (aiResponse.response) {
        rawResponse = aiResponse.response;
    } else if (aiResponse.text) {
        rawResponse = aiResponse.text;
    } else if (aiResponse.content) {
        rawResponse = aiResponse.content;
    } else if (aiResponse.message) {
        rawResponse = aiResponse.message;
    } else if (typeof aiResponse === 'string') {
        rawResponse = aiResponse;
    }
    
    console.log('Raw response length:', rawResponse.length);
    console.log('Response preview:', rawResponse.substring(0, 200));
    
    // Check if response contains HTML
    const hasHtml = /<[^>]*>/.test(rawResponse);
    console.log('Contains HTML:', hasHtml);
    
    // Preserve the original response (with HTML if present)
    output.response = rawResponse;
    output.htmlResponse = rawResponse;
    output.hasHtml = hasHtml;
    
    // Create plain text version for TTS (strip HTML tags)
    let plainText = rawResponse;
    if (hasHtml) {
        // Remove HTML tags but preserve content
        plainText = rawResponse
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style blocks
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script blocks
            .replace(/<[^>]+>/g, ' ') // Replace HTML tags with spaces
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/&lt;/g, '<') // Replace &lt; with <
            .replace(/&gt;/g, '>') // Replace &gt; with >
            .replace(/&quot;/g, '"') // Replace &quot; with "
            .replace(/&#39;/g, "'") // Replace &#39; with '
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
    }
    output.text = plainText;
    
    // Create TTS-optimized text (shorter version for speech)
    let ttsText = plainText;
    
    // Shorten for TTS if too long
    const TTS_MAX_LENGTH = 500;
    if (ttsText.length > TTS_MAX_LENGTH) {
        // Try to find a natural break point
        let cutoff = TTS_MAX_LENGTH;
        
        // Look for sentence end
        const sentenceEnd = ttsText.lastIndexOf('.', TTS_MAX_LENGTH);
        if (sentenceEnd > TTS_MAX_LENGTH * 0.7) {
            cutoff = sentenceEnd + 1;
        } else {
            // Look for other punctuation
            const otherPunct = Math.max(
                ttsText.lastIndexOf('!', TTS_MAX_LENGTH),
                ttsText.lastIndexOf('?', TTS_MAX_LENGTH),
                ttsText.lastIndexOf(',', TTS_MAX_LENGTH)
            );
            if (otherPunct > TTS_MAX_LENGTH * 0.7) {
                cutoff = otherPunct + 1;
            }
        }
        
        ttsText = ttsText.substring(0, cutoff).trim();
        
        // Add indication that there's more
        if (!ttsText.match(/[.!?]$/)) {
            ttsText += '.';
        }
        ttsText += ' I\'ve provided more details in the text response.';
        
        output.metadata.ttsSummaryApplied = true;
    } else {
        output.metadata.ttsSummaryApplied = false;
    }
    
    output.ttsText = ttsText;
    
    // Copy over other fields from AI response
    if (aiResponse.sessionId) output.sessionId = aiResponse.sessionId;
    if (aiResponse.userProfile) output.userProfile = aiResponse.userProfile;
    if (aiResponse.preview !== undefined) output.preview = aiResponse.preview;
    
    // Handle any embedded user data or search results
    if (aiResponse.userData) {
        output.userData = aiResponse.userData;
        output.metadata.hasUserData = true;
    }
    if (aiResponse.searchResults) {
        output.searchResults = aiResponse.searchResults;
        output.metadata.hasSearchResults = true;
    }
    if (aiResponse.documents) {
        output.documents = aiResponse.documents;
        output.metadata.hasDocuments = true;
    }
}

// Process second input if exists (TTS settings from workflow or memory)
if (inputs.length > 1) {
    const ttsSettings = inputs[1].json;
    console.log('Processing TTS settings from second input...');
    
    // Merge TTS settings
    if (ttsSettings.enableTTS !== undefined) output.enableTTS = ttsSettings.enableTTS;
    if (ttsSettings.voiceId) output.voiceId = ttsSettings.voiceId;
    if (ttsSettings.voiceName) output.voiceName = ttsSettings.voiceName;
    if (ttsSettings.voice) output.voice = ttsSettings.voice;
    if (ttsSettings.skipTTS !== undefined) output.skipTTS = ttsSettings.skipTTS;
    
    // Copy user profile if not already present
    if (!output.userProfile && ttsSettings.userProfile) {
        output.userProfile = ttsSettings.userProfile;
    }
    
    output.metadata.ttsSettingsFrom = 'second-input';
} else {
    // Try to get TTS settings from first input
    const firstInput = inputs[0]?.json || {};
    
    if (firstInput.enableTTS !== undefined || firstInput.voiceId) {
        console.log('Found TTS settings in first input');
        
        output.enableTTS = firstInput.enableTTS || false;
        output.voiceId = firstInput.voiceId || firstInput.voice || null;
        output.voiceName = firstInput.voiceName || null;
        output.voice = firstInput.voice || firstInput.voiceId || null;
        output.skipTTS = firstInput.skipTTS || false;
        
        output.metadata.ttsSettingsFrom = 'first-input';
    } else {
        // Default TTS settings
        console.log('Using default TTS settings');
        
        output.enableTTS = true; // Default to enabled
        output.voiceId = 'gWf6X7X75oO2lF1dH79K'; // Default voice
        output.voiceName = 'Tom';
        output.voice = 'gWf6X7X75oO2lF1dH79K';
        output.skipTTS = false;
        
        output.metadata.ttsSettingsFrom = 'defaults';
    }
}

// Ensure TTS fields are consistent
output.ttsEnabled = output.enableTTS;
output.selectedVoice = output.voiceId || output.voice;

// Add voice configuration metadata
output.metadata.voiceConfigured = output.voiceId || output.voice || 'none';
output.metadata.voiceNameConfigured = output.voiceName || 'Unknown';
output.metadata.ttsConfigured = output.enableTTS;

// Final validation
console.log('=== OUTPUT SUMMARY ===');
console.log('Has HTML:', output.hasHtml);
console.log('Response length:', output.response.length);
console.log('Plain text length:', output.text.length);
console.log('TTS text length:', output.ttsText.length);
console.log('TTS enabled:', output.enableTTS);
console.log('Voice ID:', output.voiceId);
console.log('Skip TTS:', output.skipTTS);

// Return formatted output
return [{ json: output }];