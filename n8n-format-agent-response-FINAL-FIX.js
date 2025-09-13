// FINAL FIX FOR FORMAT AGENT RESPONSE NODE
// This correctly gets voice data from the workflow chain

// Get the agent output from the AI agent node
const agentOutput = $json;

// Get the input data from earlier in the workflow
// The Format Agent Response node receives data from the AI Agent
// But we need to look back further to get the original context data
// from Prepare Context and Route node

// Method 1: Try to get from the previous execution context
let voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Default to Rachel
let voiceName = 'Rachel';
let sessionId = 'default';
let enableTTS = true;

// Look for the context data in the input items
// The AI agent passes through the original input in $input.all()
const allInputs = $input.all();

// Debug logging
console.log('=== FORMAT AGENT RESPONSE DEBUG ===');
console.log('Number of inputs:', allInputs.length);

// Search through all inputs to find the one with voice data
for (let i = 0; i < allInputs.length; i++) {
  const input = allInputs[i].json;
  console.log(`Input ${i} keys:`, Object.keys(input));
  
  // Check if this input has voice data
  if (input.voiceId || input.selectedVoice || input.voice) {
    voiceId = input.voiceId || input.selectedVoice || input.voice || voiceId;
    voiceName = input.voiceName || voiceName;
    sessionId = input.sessionId || sessionId;
    enableTTS = input.enableTTS !== undefined ? input.enableTTS : (input.ttsEnabled || enableTTS);
    
    console.log('Found voice data in input', i);
    console.log('Voice ID:', voiceId);
    console.log('Voice Name:', voiceName);
    break;
  }
  
  // Also check nested userMessage or context
  if (input.userMessage && typeof input.userMessage === 'object') {
    const nested = input.userMessage;
    if (nested.voiceId || nested.selectedVoice) {
      voiceId = nested.voiceId || nested.selectedVoice || voiceId;
      voiceName = nested.voiceName || voiceName;
      console.log('Found voice in nested userMessage');
      break;
    }
  }
}

// Method 2: Check if voice data is in the execution context
// Sometimes n8n passes context data differently
if ($node && $node["Prepare Context and Route"]) {
  try {
    const contextData = $node["Prepare Context and Route"].json;
    if (contextData) {
      voiceId = contextData.voiceId || contextData.selectedVoice || voiceId;
      voiceName = contextData.voiceName || voiceName;
      sessionId = contextData.sessionId || sessionId;
      console.log('Found voice data from Prepare Context and Route node');
    }
  } catch (e) {
    console.log('Could not access Prepare Context and Route node directly');
  }
}

// Method 3: Check the items from the previous node in the chain
// This works when data is passed through the AI agent
if ($items && $items.length > 0) {
  for (const item of $items) {
    if (item.json && (item.json.voiceId || item.json.selectedVoice)) {
      voiceId = item.json.voiceId || item.json.selectedVoice || voiceId;
      voiceName = item.json.voiceName || voiceName;
      sessionId = item.json.sessionId || sessionId;
      enableTTS = item.json.enableTTS !== undefined ? item.json.enableTTS : enableTTS;
      console.log('Found voice data in $items');
      break;
    }
  }
}

console.log('=== FINAL VOICE SELECTION ===');
console.log('Voice ID:', voiceId);
console.log('Voice Name:', voiceName);
console.log('Session ID:', sessionId);
console.log('Enable TTS:', enableTTS);
console.log('=============================');

// Check for preview mode
const isPreview = allInputs[0]?.json?.preview === true;

// Handle preview mode
if (isPreview) {
  return [{
    json: {
      response: "Hi, I'm MegaMind, your SAX AI Assistant",
      sessionId: sessionId,
      selectedVoice: voiceId,
      voiceId: voiceId,
      voiceName: voiceName,
      voice: voiceId,
      enableTTS: true,
      ttsEnabled: true,
      preview: true,
      timestamp: new Date().toISOString(),
      metadata: {
        agentType: 'SAXTech MegaMind Voice Preview',
        voiceConfigured: voiceId
      }
    }
  }];
}

// Get the actual response from the agent
let response;
if (typeof agentOutput.output === 'string') {
  response = agentOutput.output;
} else if (typeof agentOutput.text === 'string') {
  response = agentOutput.text;
} else if (typeof agentOutput.result === 'string') {
  response = agentOutput.result;
} else {
  response = 'I apologize, but I was unable to generate a proper response.';
}

// Handle TTS text summarization
const MAX_TTS_LENGTH = 300;
let ttsText = response;
let ttsSummaryApplied = false;

if (enableTTS && response.length > MAX_TTS_LENGTH) {
  // Extract text content without HTML
  const plainText = response.replace(/<[^>]+>/g, '').trim();
  
  if (plainText.length > MAX_TTS_LENGTH) {
    // Find a good breaking point
    ttsText = plainText.substring(0, MAX_TTS_LENGTH);
    const lastPeriod = ttsText.lastIndexOf('.');
    const lastQuestion = ttsText.lastIndexOf('?');
    const lastExclamation = ttsText.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > 100) {
      ttsText = ttsText.substring(0, lastSentenceEnd + 1);
    }
    ttsSummaryApplied = true;
  } else {
    ttsText = plainText;
  }
}

// Return the formatted response with the correct voice
return [{
  json: {
    response: response,
    ttsText: ttsText,
    sessionId: sessionId,
    selectedVoice: voiceId,
    voiceId: voiceId,
    voiceName: voiceName,
    voice: voiceId,
    enableTTS: enableTTS,
    ttsEnabled: enableTTS,
    ttsSummaryApplied: ttsSummaryApplied,
    preview: false,
    timestamp: new Date().toISOString(),
    metadata: {
      agentType: 'SAXTech MegaMind SAX Assistant',
      responseLength: response.length,
      ttsLength: ttsText.length,
      voiceConfigured: voiceId,
      voiceNameConfigured: voiceName,
      debugInfo: {
        inputsChecked: allInputs.length,
        voiceSource: 'workflow'
      }
    }
  }
}];