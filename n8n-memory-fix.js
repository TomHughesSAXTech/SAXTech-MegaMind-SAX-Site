// Fix for n8n Memory Node - Session ID Issue
// Place this in a Code node BEFORE your memory nodes

// Get the session ID from various possible sources
const sessionId = 
  $input.first().json.sessionId ||                    // From webhook/chat trigger
  $input.first().json.session_id ||                   // Alternative naming
  $input.first().json.body?.sessionId ||              // From webhook body
  $input.first().json.body?.session_id ||             // Alternative in body
  $input.first().json.query?.sessionId ||             // From query params
  $input.first().json.query?.session_id ||            // Alternative in query
  $input.first().json.MESSAGE_METADATA?.sessionId ||  // From your metadata
  `session_${Date.now()}`;                            // Fallback: generate one

// Pass through all existing data and ensure sessionId is included
const outputData = {
  ...$input.first().json,  // Keep all existing fields
  sessionId: sessionId      // Ensure sessionId is at the top level
};

// Log for debugging
console.log('Session ID being used:', sessionId);

return outputData;