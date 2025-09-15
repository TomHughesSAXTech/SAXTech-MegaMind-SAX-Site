// SEARCH TOOLS QUERY FIX
// This ensures the search query is properly extracted and passed to search tools
// Place this in both Quick SOP Search and Comprehensive Search nodes

const input = $json;
const allInputs = $input.all();

console.log('[Search Tool] Input received:', JSON.stringify(input).substring(0, 200));

// Extract the search query from various possible locations
let searchQuery = '';

// Try to get from direct input
if (input.query) {
  searchQuery = input.query;
} else if (input.searchQuery) {
  searchQuery = input.searchQuery;
} else if (input.search) {
  searchQuery = input.search;
} else if (input.message) {
  searchQuery = input.message;
} else if (input.userMessage) {
  searchQuery = input.userMessage;
} else if (input.text) {
  searchQuery = input.text;
}

// Try from action field (from AI agent)
if (!searchQuery && input.action) {
  if (typeof input.action === 'string') {
    searchQuery = input.action;
  } else if (input.action.input) {
    searchQuery = input.action.input;
  }
}

// Try from all inputs
if (!searchQuery) {
  for (const item of allInputs) {
    const data = item.json || item;
    if (data.query || data.searchQuery || data.message || data.action) {
      searchQuery = data.query || data.searchQuery || data.message || data.action;
      break;
    }
  }
}

console.log('[Search Tool] Extracted query:', searchQuery);

// If still no query, return error
if (!searchQuery || searchQuery.trim() === '') {
  return [{
    json: {
      success: false,
      error: 'No search query provided',
      documents: [],
      debug: {
        inputKeys: Object.keys(input),
        checkedFields: ['query', 'searchQuery', 'search', 'message', 'userMessage', 'text', 'action'],
        rawInput: JSON.stringify(input).substring(0, 500)
      }
    }
  }];
}

// YOUR EXISTING SEARCH LOGIC HERE
// For now, returning a placeholder - replace with your actual search implementation

// Example for Quick SOP Search
const results = {
  success: true,
  query: searchQuery,
  documents: [
    // Your search results here
  ],
  totalResults: 0,
  searchType: 'quick' // or 'comprehensive'
};

return [{
  json: results
}];