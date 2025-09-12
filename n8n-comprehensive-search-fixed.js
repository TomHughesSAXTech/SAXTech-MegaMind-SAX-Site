// Comprehensive Search Tool for n8n - Fixed to return string
// This performs search and returns a formatted string response

// Get input data
const userMessage = $json.userMessage || '';
const userProfile = $json.userProfile || {};
const department = userProfile.department || '';

// Simple keyword extraction
function extractKeywords(message) {
  const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from', 'what', 'where', 'when', 'how', 'who', 'why'];
  
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  return [...new Set(words)];
}

// Perform mock search (replace with actual search logic)
function performSearch(query, dept) {
  // This is where you'd integrate with your actual search tools
  // For now, return mock results based on keywords
  
  const keywords = extractKeywords(query);
  const searchResults = [];
  
  // Simulate finding relevant documents
  if (keywords.some(k => ['password', 'reset', 'account', 'login'].includes(k))) {
    searchResults.push({
      title: 'Password Reset Policy',
      snippet: 'To reset a user password, navigate to Azure AD portal or use PowerShell command: Set-MsolUserPassword',
      source: 'IT Security SOP',
      relevance: 0.95
    });
  }
  
  if (keywords.some(k => ['azure', 'cloud', 'vm', 'virtual'].includes(k))) {
    searchResults.push({
      title: 'Azure Infrastructure Guidelines',
      snippet: 'Azure VMs should be provisioned using approved templates. Use Azure Portal or Azure CLI for management.',
      source: 'Cloud Operations Manual',
      relevance: 0.90
    });
  }
  
  if (keywords.some(k => ['employee', 'staff', 'contact', 'directory'].includes(k))) {
    searchResults.push({
      title: 'Employee Directory Access',
      snippet: 'Access the employee directory through SharePoint or use Entra ID for comprehensive user information.',
      source: 'HR Systems Guide',
      relevance: 0.85
    });
  }
  
  // Add department-specific results
  if (dept.toLowerCase().includes('it')) {
    searchResults.push({
      title: 'IT Operations Handbook',
      snippet: 'As IT staff, you have access to advanced administrative tools and security protocols.',
      source: 'IT Department Resources',
      relevance: 0.80
    });
  }
  
  return searchResults;
}

// Format search results as HTML string
function formatSearchResults(results, query, userName) {
  if (results.length === 0) {
    return `
<div class="sax-response">
  <div class="greeting">
    <p>Hi ${userName}, I've searched for information about "${query}".</p>
  </div>
  <h3>🔍 Search Results</h3>
  <div class="answer-section">
    <p>I couldn't find specific documents matching your query. Let me search our external knowledge base and get back to you with more information.</p>
  </div>
  <div class="source-section">
    <p><small><em>Source: Comprehensive Search</em></small></p>
  </div>
</div>`;
  }
  
  // Build HTML response with results
  let html = `
<div class="sax-response">
  <div class="greeting">
    <p>Hi ${userName}, I found ${results.length} relevant results for "${query}".</p>
  </div>
  <h3>🔍 Search Results</h3>
  <div class="search-results">`;
  
  results.forEach((result, index) => {
    html += `
    <div class="result-item" style="margin-bottom: 15px; padding: 10px; border-left: 3px solid #2196F3;">
      <h4>${index + 1}. ${result.title}</h4>
      <p>${result.snippet}</p>
      <p><small><strong>Source:</strong> ${result.source} | <strong>Relevance:</strong> ${(result.relevance * 100).toFixed(0)}%</small></p>
    </div>`;
  });
  
  html += `
  </div>
  <div class="source-section">
    <p><small><em>Search completed at ${new Date().toISOString()}</em></small></p>
  </div>
</div>`;
  
  return html;
}

// Execute search
const searchResults = performSearch(userMessage, department);
const userName = userProfile.name ? userProfile.name.split(' ')[0] : 'there';

// Format as HTML string
const responseString = formatSearchResults(searchResults, userMessage, userName);

// Return ONLY a string in the response field
return [{
  json: {
    response: responseString,
    // Keep other data for downstream nodes if needed
    sessionId: $json.sessionId,
    searchMetadata: {
      query: userMessage,
      resultsFound: searchResults.length,
      timestamp: new Date().toISOString()
    }
  }
}];