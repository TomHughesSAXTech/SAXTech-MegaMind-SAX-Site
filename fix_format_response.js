// Fixed Format Agent Response Node Code
// This properly extracts the AI response and formats it with correct voice mapping

const fixedCode = `// Get the agent output from the previous node
const agentOutput = $json;

// Get the original input data that was passed through Build Context & Route
// This contains the selectedVoice from the webhook request
const originalInput = $input.all()[0].json;
const selectedVoice = originalInput.selectedVoice || 'sarah';
const isPreview = originalInput.preview === true;
const enableTTS = originalInput.enableTTS !== false;
const sessionId = originalInput.sessionId || 'default';

// Voice ID mapping - using correct IDs
const voiceMap = {
  'sarah': 'EXAVITQu4vr4xnSDxMaL',      // Sarah - Female Professional
  'daniel': 'onwK4e9ZLuTAKqWW03F9',     // Daniel - Male Professional  
  'emily': 'LcfcDJNUP1GQjkzn1xUU',      // Emily - British Female
  'james': 'IKne3meq5aSn9XLyUdCD',      // James - Deep Male
  'charlotte': 'XB0fDUnXU5powFXDhCwa'   // Charlotte - Energetic Female
};

// Get the correct voice ID based on selected voice
const voiceId = voiceMap[selectedVoice.toLowerCase()] || voiceMap['sarah'];

// Handle preview mode - return simple preview text
if (isPreview) {
  return [{
    json: {
      response: "Hi, I'm MegaMind, your SAX AI Assistant",
      ttsText: "Hi, I'm MegaMind, your SAX AI Assistant",
      voiceId: voiceId,
      selectedVoice: selectedVoice,
      enableTTS: true,
      skipTTS: false,
      sessionId: sessionId,
      preview: true,
      timestamp: new Date().toISOString(),
      metadata: {
        agentType: 'SAXTech MegaMind Voice Preview'
      }
    }
  }];
}

// Normal processing - extract the actual response from agent
let response = '';
let webhookData = {};

// Extract text from agent output based on various possible structures
if (agentOutput.output) {
  // Standard agent output structure
  response = agentOutput.output;
  webhookData = agentOutput;
} else if (agentOutput.webhookData && agentOutput.webhookData.output) {
  // Nested webhook data structure
  response = agentOutput.webhookData.output;
  webhookData = agentOutput.webhookData;
} else if (agentOutput.text) {
  // Alternative text field
  response = agentOutput.text;
  webhookData = { output: response };
} else if (agentOutput.result) {
  // Alternative result field
  response = agentOutput.result;
  webhookData = { output: response };
} else if (typeof agentOutput === 'string') {
  // Direct string response
  response = agentOutput;
  webhookData = { output: response };
} else {
  // Fallback - couldn't extract response
  response = 'I apologize, but I was unable to generate a proper response. Please try again.';
  webhookData = { output: response };
}

// Clean up the response text (remove any leftover HTML if present)
let ttsText = response;
if (ttsText.includes('<')) {
  // Strip HTML tags for TTS
  ttsText = ttsText.replace(/<[^>]*>/g, '');
}

// Handle TTS text summarization if needed
let skipTTS = false;
if (enableTTS && ttsText.length > 500) {
  // For long responses, create a shorter TTS summary
  const sentences = ttsText.match(/[^.!?]+[.!?]+/g) || [ttsText];
  
  if (sentences.length > 3) {
    // Take first 2 sentences and add a note
    ttsText = sentences.slice(0, 2).join(' ').trim() + 
              " I've provided more details in the text response.";
  } else if (ttsText.length > 300) {
    // Find a good break point
    let cutoff = ttsText.substring(0, 200).lastIndexOf('. ');
    if (cutoff === -1) cutoff = ttsText.substring(0, 200).lastIndexOf(' ');
    if (cutoff === -1) cutoff = 200;
    
    ttsText = ttsText.substring(0, cutoff).trim() + 
              "... Please see the full response for more details.";
  }
} else if (!enableTTS) {
  skipTTS = true;
  ttsText = '';
}

// Build proper response structure with all necessary fields
return [{
  json: {
    response: response,
    ttsText: ttsText,
    voiceId: voiceId,
    selectedVoice: selectedVoice,
    enableTTS: enableTTS,
    skipTTS: skipTTS,
    webhookData: webhookData,
    processingInfo: {
      voiceUsed: selectedVoice,
      voiceIdUsed: voiceId,
      ttsEnabled: enableTTS,
      ttsSummaryApplied: ttsText !== response && enableTTS,
      isPreview: false
    },
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    metadata: {
      agentType: 'SAXTech MegaMind SAX Assistant',
      responseLength: response.length,
      ttsLength: ttsText.length
    }
  }
}];`;

console.log("===========================================");
console.log("FORMAT AGENT RESPONSE NODE - FIXED CODE");
console.log("===========================================");
console.log("");
console.log("Instructions:");
console.log("1. Open your n8n workflow 'SAXTech MegaMind SAX'");
console.log("2. Find ALL 'Format Agent Response' nodes (there are multiple)");
console.log("3. For each one:");
console.log("   - Double-click to open");
console.log("   - Replace the JavaScript code with the code below");
console.log("   - Click 'Save'");
console.log("");
console.log("These nodes need updating:");
console.log("- Format Agent Response1 (after Megamind SAX SAGE)");
console.log("- Format Agent Response2 (after Megamind SAX TAX)");
console.log("- Format Agent Response4 (after Megamind SAX TEACHER)");
console.log("");
console.log("===========================================");
console.log("COPY THIS CODE:");
console.log("===========================================");
console.log("");
console.log(fixedCode);
console.log("");
console.log("===========================================");
console.log("EXPLANATION OF THE FIX:");
console.log("===========================================");
console.log("");
console.log("The main issues fixed:");
console.log("1. Properly extracts the AI response from 'output' field");
console.log("2. Correctly maps voice names to ElevenLabs voice IDs");
console.log("3. Returns proper structure with all required fields");
console.log("4. Handles TTS enable/disable correctly");
console.log("5. Preserves the original webhookData for downstream nodes");
console.log("");
console.log("The output structure now includes:");
console.log("- response: The actual AI text response");
console.log("- ttsText: The text for TTS (may be shortened)");
console.log("- voiceId: The correct ElevenLabs voice ID");
console.log("- selectedVoice: The voice name");
console.log("- enableTTS: Whether TTS should be used");
console.log("- skipTTS: Whether to skip TTS processing");
console.log("- webhookData: Original data for reference");
console.log("- processingInfo: Metadata about processing");
console.log("");
console.log("This should resolve the issue where the AI responds correctly");
console.log("but the output formatting causes empty responses.");