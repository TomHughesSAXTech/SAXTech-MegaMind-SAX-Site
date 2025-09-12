// Comprehensive Search Node for n8n
// This performs deep semantic search with vector embeddings and multi-source queries

// Get input data from previous node
const userMessage = $json.userMessage || '';
const userProfile = $json.userProfile || {};
const quickSearchResults = $json.quickSearchResults || null;
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

// Build comprehensive search strategy
function buildSearchStrategy(message, profile, quickResults) {
  const semanticConcepts = extractSemanticConcepts(message);
  
  const strategy = {
    primary: {
      method: 'vector_similarity',
      query: message,
      embedding_model: 'text-embedding-ada-002',
      top_k: 10,
      threshold: 0.7
    },
    secondary: {
      method: 'keyword_hybrid',
      keywords: quickResults?.extractedKeywords || [],
      categories: quickResults?.identifiedCategories || [],
      boost_recent: true,
      date_range: 'last_6_months'
    },
    contextual: {
      user_department: profile.department,
      user_role: profile.jobTitle,
      user_permissions: profile.permissions || [],
      access_level: profile.isExecutive ? 'executive' : 'standard'
    },
    sources: [
      {
        name: 'internal_knowledge_base',
        weight: 0.4,
        filters: {
          departments: [department, 'all'],
          document_types: ['sop', 'policy', 'guide', 'faq']
        }
      },
      {
        name: 'employee_directory',
        weight: 0.2,
        enabled: semanticConcepts.entities.length > 0
      },
      {
        name: 'sax_website',
        weight: 0.2,
        url: 'https://saxadvisorygroup.com'
      },
      {
        name: 'external_search',
        weight: 0.2,
        fallback: true
      }
    ],
    reranking: {
      enabled: true,
      model: 'cross-encoder',
      personalization_weight: 0.3
    }
  };
  
  return strategy;
}

// Generate vector search queries
function generateVectorQueries(message, concepts, profile) {
  const queries = [];
  
  // Main query
  queries.push({
    text: message,
    weight: 1.0,
    type: 'original'
  });
  
  // Department-specific reformulation
  if (profile.department === 'IT') {
    queries.push({
      text: `${message} technical implementation azure cloud infrastructure`,
      weight: 0.7,
      type: 'department_enhanced'
    });
  } else if (profile.department === 'Finance') {
    queries.push({
      text: `${message} financial accounting GAAP compliance`,
      weight: 0.7,
      type: 'department_enhanced'
    });
  } else if (profile.department === 'HR') {
    queries.push({
      text: `${message} human resources employee policy`,
      weight: 0.7,
      type: 'department_enhanced'
    });
  }
  
  // Intent-based reformulation
  if (concepts.intents.includes('procedure_request')) {
    queries.push({
      text: `step by step procedure how to ${message}`,
      weight: 0.5,
      type: 'procedural'
    });
  }
  
  if (concepts.intents.includes('policy_inquiry')) {
    queries.push({
      text: `SAX Advisory Group policy compliance regulation ${message}`,
      weight: 0.5,
      type: 'policy'
    });
  }
  
  return queries;
}

// Extract semantic concepts
const concepts = extractSemanticConcepts(userMessage);

// Build search strategy
const searchStrategy = buildSearchStrategy(userMessage, userProfile, quickSearchResults);

// Generate vector queries
const vectorQueries = generateVectorQueries(userMessage, concepts, userProfile);

// Construct comprehensive search request
const comprehensiveSearch = {
  searchId: `search_${Date.now()}`,
  sessionId: sessionId,
  timestamp: new Date().toISOString(),
  user: {
    name: userProfile.name,
    department: userProfile.department,
    role: userProfile.jobTitle,
    permissions: userProfile.permissions
  },
  query: {
    original: userMessage,
    enhanced: vectorQueries,
    concepts: concepts
  },
  strategy: searchStrategy,
  searchConfig: {
    maxResults: 20,
    minRelevance: 0.6,
    includeSources: true,
    includeSnippets: true,
    highlightTerms: true,
    groupBySource: true,
    deduplication: true
  },
  metadata: {
    searchType: 'comprehensive',
    previousSearchType: quickSearchResults ? 'quick' : 'none',
    sessionMessageCount: $json.userContext?.previousMessages || 0
  }
};

// Prepare aggregated result
const searchResult = {
  // Original data
  ...$json,
  // Comprehensive search configuration
  comprehensiveSearch: comprehensiveSearch,
  // Search execution status
  searchStatus: {
    quickSearchCompleted: !!quickSearchResults,
    comprehensiveSearchReady: true,
    vectorQueriesGenerated: vectorQueries.length,
    sourcesConfigured: searchStrategy.sources.length
  },
  // Instructions for next nodes
  nextSteps: {
    vectorStore: {
      action: 'execute_search',
      queries: vectorQueries,
      filters: searchStrategy.contextual
    },
    entraSearch: {
      enabled: concepts.entities.length > 0,
      entities: concepts.entities
    },
    externalSearch: {
      fallback: true,
      query: userMessage
    }
  }
};

// Return comprehensive search configuration
return [{
  json: searchResult
}];