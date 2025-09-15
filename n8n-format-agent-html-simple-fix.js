// N8N CODE NODE: Format Agent Response - Simple HTML Preservation
// Quick fix to preserve HTML in responses while maintaining TTS functionality

const input = $input.all()[0].json;

// Get the AI response - preserve exactly as received
const aiResponse = input.output || input.response || input.text || input.content || '';

// Check if it contains HTML
const hasHtml = /<[^>]*>/.test(aiResponse);

// Create plain text version for TTS only
let ttsText = aiResponse;
if (hasHtml) {
    // Strip HTML for TTS but keep original for display
    ttsText = aiResponse
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Shorten if needed
    if (ttsText.length > 500) {
        ttsText = ttsText.substring(0, 497) + '...';
    }
}

// Build output - PRESERVE THE ORIGINAL HTML RESPONSE
const output = {
    // Keep original HTML intact
    response: aiResponse,
    
    // Plain text version
    text: ttsText,
    
    // TTS version (shortened plain text)
    ttsText: ttsText,
    
    // Keep HTML version separately for clarity
    htmlResponse: aiResponse,
    hasHtml: hasHtml,
    
    // Copy all other fields
    ...input,
    
    // Override with our processed versions
    response: aiResponse,
    text: ttsText,
    ttsText: ttsText
};

// Ensure TTS settings are preserved
if (input.enableTTS !== undefined) output.enableTTS = input.enableTTS;
if (input.voiceId) output.voiceId = input.voiceId;
if (input.voiceName) output.voiceName = input.voiceName;
output.ttsEnabled = output.enableTTS;

console.log('HTML preserved:', hasHtml);
console.log('Response preview:', aiResponse.substring(0, 100));

return [{ json: output }];