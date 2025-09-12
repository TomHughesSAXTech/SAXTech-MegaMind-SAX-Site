# Fix for "Wrong output type returned" Error

## Problem:
The Agent node is returning an object instead of a string for the response property.

## Solutions:

### Solution 1: Add a Code Node After Agent to Extract Response

Add a **Code** node immediately after your Agent node with this code:

```javascript
// Extract the response string from the Agent output
const agentOutput = $input.item.json;

// Handle different possible response structures
let responseText = '';

if (typeof agentOutput === 'string') {
  // If it's already a string
  responseText = agentOutput;
} else if (agentOutput.response) {
  // If response is nested
  responseText = typeof agentOutput.response === 'string' 
    ? agentOutput.response 
    : JSON.stringify(agentOutput.response);
} else if (agentOutput.output) {
  // Alternative property name
  responseText = typeof agentOutput.output === 'string'
    ? agentOutput.output
    : JSON.stringify(agentOutput.output);
} else if (agentOutput.text) {
  // Another common property
  responseText = agentOutput.text;
} else if (agentOutput.message) {
  // Message property
  responseText = agentOutput.message;
} else {
  // Fallback - stringify the whole object
  responseText = JSON.stringify(agentOutput);
}

// Return properly formatted for next node
return [{
  json: {
    response: responseText,
    sessionId: $json.sessionId || agentOutput.sessionId,
    userProfile: $json.userProfile || agentOutput.userProfile,
    originalOutput: agentOutput
  }
}];
```

### Solution 2: Configure Agent Output Mode

In your **Agent** node settings:

1. Look for **Output Parser** or **Response Mode** settings
2. Set to: **Text** or **String** mode (not JSON)
3. Or add an Output Parser that returns text

### Solution 3: Use Basic LLM Chain Instead of Agent

If the Agent continues to have issues, use a simpler setup:

1. Replace the Agent node with:
   - **OpenAI Chat Model** node (or Anthropic)
   - Configure with your prompt directly

2. In the Chat Model node:
   - System Message: Use your complete prompt
   - Human Message: `{{$json["userMessage"]}}`
   - Response Format: Text

### Solution 4: Format Response in Agent Instructions

Add this to the END of your Agent system prompt:

```
CRITICAL OUTPUT INSTRUCTION:
Your response must be a single string of HTML-formatted text. 
Do not return JSON objects or structured data.
Return only the HTML response as plain text.
```

### Solution 5: Complete Working Response Formatter Node

Add this Code node after your Agent to ensure proper formatting:

```javascript
// Response Formatter Node - Ensures string output with HTML
const input = $input.item.json;

// Extract response from various possible locations
function extractResponse(data) {
  // Check common response properties
  const possibleProps = ['response', 'output', 'text', 'message', 'content', 'answer'];
  
  for (const prop of possibleProps) {
    if (data[prop]) {
      if (typeof data[prop] === 'string') {
        return data[prop];
      } else if (typeof data[prop] === 'object' && data[prop].text) {
        return data[prop].text;
      } else if (typeof data[prop] === 'object' && data[prop].content) {
        return data[prop].content;
      }
    }
  }
  
  // Check if the input itself is the response
  if (typeof data === 'string') {
    return data;
  }
  
  // Last resort - stringify
  return JSON.stringify(data);
}

const responseText = extractResponse(input);

// Ensure HTML formatting is present
const htmlResponse = responseText.includes('<div') 
  ? responseText 
  : `<div class="sax-response"><p>${responseText}</p></div>`;

// Package for webhook response
const formattedResponse = {
  response: htmlResponse,
  sessionId: input.sessionId || $json.sessionId,
  voice: input.selectedVoice || $json.selectedVoice || 'sarah',
  enableTTS: input.enableTTS !== undefined ? input.enableTTS : true,
  metadata: {
    timestamp: new Date().toISOString(),
    processed: true
  }
};

return [{
  json: formattedResponse
}];
```

## Quick Test:

To quickly test if the fix works:

1. Add a **Set** node after your Agent with:
   - Name: `response`
   - Value: `{{$json.response || $json.output || $json.text || "No response found"}}`
   - Type: String

2. This will force the response to be a string.

## Recommended Approach:

Use **Solution 1** - Add the Response Formatter Code node after your Agent. This ensures:
- Response is always a string
- HTML formatting is preserved
- Fallbacks for different output structures
- Session data is maintained