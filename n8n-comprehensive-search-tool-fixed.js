// Comprehensive Search Tool for n8n Agent - Returns String Response
// This performs deep semantic search and returns formatted HTML string

// Get input data from the tool call
const userMessage = $json.userMessage || '';
const userProfile = $json.userProfile || {};
const userContext = $json.userContext || {};
const department = userProfile.department || '';
const sessionId = $json.sessionId;

// Enhanced keyword extraction with NLP concepts
function extractSemanticConcepts(message) {
  const concepts = {
    entities: [],
    actions: [],
    topics: [],
    intents: []
  };
  
  // Extract potential entities (capitalized words, acronyms)
  const entityPattern = /\b[A-Z][a-z]+\b|\b[A-Z]{2,}\b/g;
  concepts.entities = (message.match(entityPattern) || []);
  
  // Extract action words (verbs)
  const actionWords = ['create', 'delete', 'update', 'find', 'search', 'get', 'set', 'configure', 'install', 'deploy', 'backup', 'restore', 'reset', 'enable', 'disable', 'approve', 'reject', 'submit', 'review', 'calculate', 'generate', 'export', 'import'];
  concepts.actions = actionWords.filter(action => 
    message.toLowerCase().includes(action)
  );
  
  // Determine intent
  if (message.includes('?')) {
    concepts.intents.push('question');
  }
  if (concepts.actions.length > 0) {
    concepts.intents.push('action_request');
  }
  if (message.toLowerCase().includes('how to') || message.toLowerCase().includes('steps to')) {
    concepts.intents.push('procedure_request');
  }
  if (message.toLowerCase().includes('policy') || message.toLowerCase().includes('compliance')) {
    concepts.intents.push('policy_inquiry');
  }
  
  return concepts;
}

// Build search queries based on department and context
function buildSearchQueries(message, profile) {
  const queries = [];
  
  // Main query
  queries.push({
    text: message,
    weight: 1.0
  });
  
  // Department-specific enhancement
  if (profile.department === 'IT') {
    queries.push({
      text: `${message} technical implementation azure infrastructure security`,
      weight: 0.7
    });
  } else if (profile.department === 'Finance') {
    queries.push({
      text: `${message} financial accounting GAAP compliance tax`,
      weight: 0.7
    });
  } else if (profile.department === 'HR') {
    queries.push({
      text: `${message} human resources employee policy benefits`,
      weight: 0.7
    });
  }
  
  return queries;
}

// Simulate comprehensive search (replace with actual search implementation)
function performComprehensiveSearch(queries, concepts, dept) {
  const results = [];
  const primaryQuery = queries[0].text.toLowerCase();
  
  // Knowledge base search simulation
  const knowledgeBase = [
    {
      title: 'Azure AD User Management Guide',
      content: 'Complete guide for managing users in Azure Active Directory including password resets, MFA setup, and group assignments.',
      category: 'IT',
      relevance: primaryQuery.includes('user') || primaryQuery.includes('password') || primaryQuery.includes('azure')
    },
    {
      title: 'IT Security Best Practices',
      content: 'Security protocols including password policies, VPN access, and incident response procedures.',
      category: 'IT',
      relevance: primaryQuery.includes('security') || primaryQuery.includes('password') || primaryQuery.includes('vpn')
    },
    {
      title: 'Employee Onboarding Process',
      content: 'Step-by-step process for onboarding new employees including system access, training, and documentation.',
      category: 'HR',
      relevance: primaryQuery.includes('employee') || primaryQuery.includes('onboard') || primaryQuery.includes('new')
    },
    {
      title: 'Financial Reporting Standards',
      content: 'GAAP compliance guidelines and monthly reporting procedures for SAX Advisory Group.',
      category: 'Finance',
      relevance: primaryQuery.includes('financial') || primaryQuery.includes('report') || primaryQuery.includes('gaap')
    },
    {
      title: 'Azure Infrastructure Management',
      content: 'Managing Azure resources including VMs, storage accounts, and network security groups.',
      category: 'IT',
      relevance: primaryQuery.includes('azure') || primaryQuery.includes('vm') || primaryQuery.includes('cloud')
    }
  ];
  
  // Filter and score results
  knowledgeBase.forEach(doc => {
    let score = 0;
    
    // Check relevance
    if (doc.relevance) score += 0.5;
    
    // Department match
    if (doc.category === dept) score += 0.3;
    
    // Entity match
    if (concepts.entities.some(e => doc.title.includes(e) || doc.content.includes(e))) score += 0.2;
    
    // Action match
    if (concepts.actions.some(a => doc.content.toLowerCase().includes(a))) score += 0.1;
    
    if (score > 0.3) {
      results.push({
        ...doc,
        score: score,
        snippet: doc.content.substring(0, 150) + '...'
      });
    }
  });
  
  // Sort by score
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, 5);
}

// Format the search results as an HTML string response
function formatSearchResponse(results, query, userName, dept, concepts) {
  const firstName = userName ? userName.split(' ')[0] : 'there';
  
  // Build personalized greeting based on context
  let greeting = `Hi ${firstName}!`;
  if (dept === 'IT') {
    greeting += ` Let me search our technical documentation for you.`;
  } else if (dept === 'Finance') {
    greeting += ` Let me check our financial resources.`;
  } else if (dept === 'HR') {
    greeting += ` Let me look up that HR information.`;
  } else {
    greeting += ` Let me search for that information.`;
  }
  
  // Build HTML response
  let html = `<div class="sax-response">
    <div class="greeting">
      <p>${greeting}</p>
    </div>
    <h3>🔍 Comprehensive Search Results</h3>`;
  
  if (results.length === 0) {
    html += `
    <div class="answer-section">
      <p>I couldn't find specific documents matching "<strong>${query}</strong>" in our internal knowledge base.</p>
      <p>Let me search external sources for more information.</p>
    </div>`;
  } else {
    html += `
    <div class="answer-section">
      <p>I found <strong>${results.length}</strong> relevant documents for "<strong>${query}</strong>":</p>
    </div>
    <div class="search-results">`;
    
    results.forEach((result, index) => {
      const relevancePercent = Math.round(result.score * 100);
      const relevanceColor = relevancePercent > 70 ? '#4CAF50' : relevancePercent > 40 ? '#FF9800' : '#9E9E9E';
      
      html += `
      <div class="result-item" style="margin: 10px 0; padding: 12px; border-left: 4px solid ${relevanceColor}; background: #f9f9f9;">
        <h4 style="margin: 0 0 8px 0; color: #333;">📄 ${result.title}</h4>
        <p style="margin: 0 0 8px 0; color: #666;">${result.snippet}</p>
        <div style="font-size: 0.9em; color: #999;">
          <span style="margin-right: 15px;"><strong>Category:</strong> ${result.category}</span>
          <span><strong>Relevance:</strong> <span style="color: ${relevanceColor};">${relevancePercent}%</span></span>
        </div>
      </div>`;
    });
    
    html += `</div>`;
  }
  
  // Add search metadata
  html += `
    <div class="search-metadata" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 0.85em; color: #999;">
        <strong>Search Analysis:</strong><br>`;
  
  if (concepts.entities.length > 0) {
    html += `Entities detected: ${concepts.entities.join(', ')}<br>`;
  }
  if (concepts.actions.length > 0) {
    html += `Actions identified: ${concepts.actions.join(', ')}<br>`;
  }
  if (concepts.intents.length > 0) {
    html += `Intent: ${concepts.intents.join(', ')}<br>`;
  }
  
  html += `
        Search scope: ${dept || 'All'} Department<br>
        Timestamp: ${new Date().toLocaleString()}
      </p>
    </div>
  </div>`;
  
  return html;
}

// Main execution
try {
  // Extract semantic concepts
  const concepts = extractSemanticConcepts(userMessage);
  
  // Build search queries
  const queries = buildSearchQueries(userMessage, userProfile);
  
  // Perform comprehensive search
  const searchResults = performComprehensiveSearch(queries, concepts, department);
  
  // Format as HTML string
  const htmlResponse = formatSearchResponse(
    searchResults, 
    userMessage, 
    userProfile.name,
    department,
    concepts
  );
  
  // IMPORTANT: Return ONLY a string for the Agent tool
  // The Agent expects the tool to return a string, not an object
  return htmlResponse;
  
} catch (error) {
  // Error handling - return error as formatted string
  const errorResponse = `
<div class="sax-response">
  <div class="greeting">
    <p>Hi ${userProfile.name ? userProfile.name.split(' ')[0] : 'there'}, I encountered an issue with the search.</p>
  </div>
  <h3>⚠️ Search Error</h3>
  <div class="answer-section">
    <p>I wasn't able to complete the comprehensive search due to a technical issue.</p>
    <p><small>Error: ${error.message || 'Unknown error'}</small></p>
    <p>Please try rephrasing your question or contact IT support if the issue persists.</p>
  </div>
</div>`;
  
  return errorResponse;
}