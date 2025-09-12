// Quick Search Node for n8n
// This performs a fast keyword-based search for immediate results

// Get the user's message and context
const userMessage = $json.userMessage || '';
const userProfile = $json.userProfile || {};
const department = userProfile.department || '';

// Extract keywords from the user's message
function extractKeywords(message) {
  // Remove common words and keep meaningful terms
  const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from', 'what', 'where', 'when', 'how', 'who', 'why', 'can', 'could', 'would', 'should', 'shall', 'will', 'may', 'might', 'must', 'do', 'does', 'did', 'have', 'has', 'had', 'be', 'am', 'are', 'was', 'were', 'been'];
  
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  return [...new Set(words)]; // Remove duplicates
}

// Determine search categories based on keywords
function determineSearchCategories(keywords, dept) {
  const categories = [];
  
  // Department-specific categorization
  if (dept.toLowerCase().includes('it')) {
    categories.push('technology', 'security', 'infrastructure');
  } else if (dept.toLowerCase().includes('finance')) {
    categories.push('accounting', 'tax', 'financial');
  } else if (dept.toLowerCase().includes('hr')) {
    categories.push('hr', 'employee', 'benefits');
  }
  
  // Keyword-based categorization
  const categoryMap = {
    technology: ['azure', 'cloud', 'server', 'network', 'security', 'backup', 'password', 'vpn', 'firewall', 'microsoft', 'office', 'teams', 'sharepoint', 'onedrive'],
    tax: ['tax', 'irs', 'return', 'deduction', 'audit', 'compliance', '1099', 'w2', 'ein', 'revenue'],
    hr: ['employee', 'hire', 'termination', 'benefits', 'pto', 'vacation', 'sick', 'leave', 'handbook', 'policy'],
    finance: ['budget', 'expense', 'revenue', 'profit', 'loss', 'invoice', 'payment', 'accounting', 'gaap', 'financial'],
    compliance: ['compliance', 'regulation', 'sox', 'gdpr', 'hipaa', 'pci', 'audit', 'control'],
    operations: ['process', 'procedure', 'workflow', 'approval', 'sop', 'policy']
  };
  
  for (const [category, terms] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => terms.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return [...new Set(categories)]; // Remove duplicates
}

// Build search query
const keywords = extractKeywords(userMessage);
const categories = determineSearchCategories(keywords, department);

// Construct search parameters
const searchParams = {
  keywords: keywords,
  categories: categories,
  filters: {
    department: department,
    userRole: userProfile.jobTitle || '',
    accessLevel: userProfile.isExecutive ? 'executive' : 'standard'
  },
  searchType: 'quick',
  maxResults: 5,
  includeMetadata: true
};

// Build search query string for vector store or search tool
const searchQuery = {
  query: keywords.join(' '),
  filter: {
    categories: categories,
    department: department
  },
  options: {
    fuzzy: true,
    boost: {
      title: 2.0,
      keywords: 1.5,
      content: 1.0
    },
    highlight: true,
    snippetLength: 200
  }
};

// Prepare response with search metadata
const quickSearchResult = {
  userMessage: userMessage,
  searchExecuted: true,
  searchType: 'quick',
  extractedKeywords: keywords,
  identifiedCategories: categories,
  searchQuery: searchQuery,
  searchParams: searchParams,
  timestamp: new Date().toISOString(),
  userContext: {
    department: department,
    role: userProfile.jobTitle,
    name: userProfile.name
  },
  // Pass through all original data
  ...$json
};

// Return the search configuration for the next node
return [{
  json: quickSearchResult
}];