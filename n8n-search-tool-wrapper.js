// SEARCH TOOL INPUT WRAPPER
// Place this between AI Agent and Search Tools
// Converts AI Agent's { query: "..." } to the format search tools expect

const input = $json;

// The AI Agent sends { query: "..." }
// The search tool wants it in $input.item.json.userMessage

// Extract the query from wherever the AI Agent put it
const searchQuery = input.query || input.action || input.message || input.text || '';

console.log('[Search Wrapper] Received from AI Agent:', input);
console.log('[Search Wrapper] Extracted query:', searchQuery);

// Format it the way the search tool expects
return [{
  json: {
    userMessage: searchQuery,  // This is what the search tool code looks for
    query: searchQuery,        // Also include as query for compatibility
    originalInput: input       // Keep original for debugging
  }
}];