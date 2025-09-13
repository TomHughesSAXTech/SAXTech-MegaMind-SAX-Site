// n8n Code Node: Handle ElevenLabs Audio
// This node should be added AFTER the AI Agent response and BEFORE the Webhook Response
// It takes the AI response and generates audio using ElevenLabs TTS API

// Get the response from the previous AI Agent node
const aiResponse = $input.item.json;

// Get the voice settings from the original webhook input
const originalInput = $items("MegaMind SAX SAGE Webhook")[0].json.body || $items("MegaMind SAX SAGE Webhook")[0].json;

// Extract voice configuration with proper fallbacks
const voiceId = originalInput.voice || 
               originalInput.voiceId || 
               originalInput.selectedVoice || 
               'EXAVITQu4vr4xnSDxMaL'; // Rachel as default

const enableTTS = originalInput.enableTTS !== false; // Default to true
const ttsSummarize = originalInput.ttsSummarize === true;
const ttsSummaryLength = originalInput.ttsSummaryLength || 'short';

console.log('TTS Configuration:', {
    voiceId: voiceId,
    enableTTS: enableTTS,
    ttsSummarize: ttsSummarize,
    ttsSummaryLength: ttsSummaryLength,
    aiResponseLength: aiResponse.output ? aiResponse.output.length : 0
});

// If TTS is disabled, return the response without audio
if (!enableTTS) {
    console.log('TTS is disabled, returning response without audio');
    return [{
        json: {
            response: aiResponse.output || aiResponse.text || aiResponse.result || 'No response generated',
            sessionId: originalInput.sessionId || 'default',
            selectedVoice: voiceId,
            enableTTS: false,
            timestamp: new Date().toISOString(),
            metadata: {
                agentType: 'SAXTech MegaMind',
                ttsSkipped: true
            }
        }
    }];
}

// Extract text response from various possible fields
let textToSpeak = '';
if (typeof aiResponse.output === 'string') {
    textToSpeak = aiResponse.output;
} else if (typeof aiResponse.text === 'string') {
    textToSpeak = aiResponse.text;
} else if (typeof aiResponse.result === 'string') {
    textToSpeak = aiResponse.result;
} else if (typeof aiResponse.response === 'string') {
    textToSpeak = aiResponse.response;
} else {
    console.log('No text found in AI response');
    return [{
        json: {
            response: 'I apologize, but I could not generate a proper response.',
            sessionId: originalInput.sessionId || 'default',
            selectedVoice: voiceId,
            enableTTS: false,
            timestamp: new Date().toISOString()
        }
    }];
}

// Clean HTML from the response for TTS
function cleanHTMLForTTS(html) {
    // Remove all HTML tags
    let text = html.replace(/<[^>]*>/g, ' ');
    // Remove style blocks
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove script blocks
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    // Clean up multiple spaces and newlines
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

// Clean the text for TTS
let cleanText = cleanHTMLForTTS(textToSpeak);

// Summarize if needed (for long responses)
if (ttsSummarize && cleanText.length > 500) {
    console.log('Text too long, summarizing for TTS');
    // Extract the first paragraph or first 2-3 sentences
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    if (ttsSummaryLength === 'short') {
        // Take first 2 sentences
        cleanText = sentences.slice(0, 2).join(' ');
    } else {
        // Take first 3-4 sentences
        cleanText = sentences.slice(0, 4).join(' ');
    }
    
    // Add a brief ending
    if (sentences.length > 4) {
        cleanText += ' I have more information available if you need it.';
    }
}

// Limit text length for ElevenLabs (they have a 5000 character limit per request)
if (cleanText.length > 4500) {
    cleanText = cleanText.substring(0, 4400) + '... I have more information available.';
}

console.log('Text prepared for TTS, length:', cleanText.length);

// Call ElevenLabs API
try {
    const elevenLabsApiKey = 'sk_897e42797fb2f3c07fb336bxxxxxxxxxxxxxxxxxxxxxxx'; // Replace with actual API key
    const elevenLabsUrl = 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId;
    
    console.log('Calling ElevenLabs API with voice ID:', voiceId);
    
    const response = await this.helpers.httpRequest({
        method: 'POST',
        url: elevenLabsUrl,
        headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
        },
        body: {
            text: cleanText,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true
            }
        },
        encoding: 'base64',
        json: false,
        returnFullResponse: false
    });
    
    console.log('ElevenLabs API response received, audio length:', response.length);
    
    // Return the response with audio
    return [{
        json: {
            response: textToSpeak, // Original HTML response
            audioBase64: response, // Base64 encoded audio
            sessionId: originalInput.sessionId || 'default',
            selectedVoice: voiceId,
            enableTTS: true,
            timestamp: new Date().toISOString(),
            metadata: {
                agentType: 'SAXTech MegaMind',
                voiceUsed: voiceId,
                textLength: cleanText.length,
                audioGenerated: true
            }
        }
    }];
    
} catch (error) {
    console.error('ElevenLabs API error:', error);
    
    // Return response without audio on error
    return [{
        json: {
            response: textToSpeak,
            sessionId: originalInput.sessionId || 'default',
            selectedVoice: voiceId,
            enableTTS: true,
            timestamp: new Date().toISOString(),
            metadata: {
                agentType: 'SAXTech MegaMind',
                ttsError: error.message || 'TTS generation failed',
                audioGenerated: false
            }
        }
    }];
}