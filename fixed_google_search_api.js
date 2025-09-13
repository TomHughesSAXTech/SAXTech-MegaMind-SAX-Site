// Universal Google Search API for n8n
// Handles BOTH professional queries AND general web searches (weather, news, etc.)
// Version: 6.0 - Fixed for all search types
// Last Updated: 2025-09-13

try {
  // Get the search query from the 'query' variable (no $ prefix)
  let searchQuery = '';
  
  // Primary source: the 'query' variable
  if (typeof query !== 'undefined' && query) {
    searchQuery = query;
    console.log('Query found in query variable:', searchQuery);
  } 
  // Fallback: check if it's in $query
  else if (typeof $query !== 'undefined' && $query) {
    searchQuery = $query;
    console.log('Query found in $query variable:', searchQuery);
  }
  // Additional fallback: check $json for query fields
  else if (typeof $json !== 'undefined' && $json) {
    searchQuery = $json.query || $json.search || $json.question || $json.input || '';
    if (searchQuery) console.log('Query found in $json:', searchQuery);
  }
  // Final fallback: check $input as string
  else if (typeof $input === 'string' && $input) {
    searchQuery = $input;
    console.log('Query found as $input string:', searchQuery);
  }
  
  if (!searchQuery || searchQuery.trim() === '') {
    return "No search query provided. Please include a search query.";
  }

  const lowerQuery = searchQuery.toLowerCase();
  let enhancedQuery = searchQuery;
  let siteRestrictions = '';
  let searchMode = 'general';

  // Define professional service site collections
  const professionalSites = {
    tax: [
      'irs.gov',
      'taxnotes.com',
      'aicpa.org',
      'thetaxadviser.com',
      'journalofaccountancy.com',
      'cch.com',
      'thomsonreuters.com',
      'bna.com',
      'taxpayeradvocate.irs.gov',
      'ustaxcourt.gov'
    ],
    accounting: [
      'fasb.org',
      'aicpa.org',
      'journalofaccountancy.com',
      'accountingtoday.com',
      'cpajournal.com',
      'ifrs.org',
      'gasb.org',
      'sec.gov',
      'pcaobus.org'
    ],
    audit: [
      'pcaobus.org',
      'aicpa.org',
      'rsmus.com',
      'gao.gov',
      'isaca.org',
      'theiia.org',
      'sox-online.com',
      'auditboard.com',
      'sec.gov/news/speech'
    ],
    wealthManagement: [
      'cfainstitute.org',
      'finra.org',
      'sec.gov/investment',
      'morningstar.com',
      'kitces.com',
      'investopedia.com',
      'fa-mag.com',
      'wealthmanagement.com',
      'financial-planning.com'
    ],
    legal: [
      'law.cornell.edu',
      'justia.com',
      'findlaw.com',
      'americanbar.org',
      'lexisnexis.com',
      'westlaw.com',
      'uscourts.gov',
      'supremecourt.gov'
    ],
    estatePlanning: [
      'actec.org',
      'americanbar.org/groups/real_property_trust_estate',
      'irs.gov/businesses/small-businesses-self-employed/estate-tax',
      'naepc.org',
      'estateplanning.com',
      'wealthmanagement.com/estate-planning'
    ]
  };

  // FIRST: Check if this is a general web query (weather, news, etc.)
  // These should NEVER have site restrictions
  if (lowerQuery.match(/\b(weather|temperature|forecast|rain|snow|sunny|cloudy|wind|storm)\b/i) ||
      lowerQuery.match(/\b(news|breaking|latest|today|yesterday|tomorrow)\b/i) ||
      lowerQuery.match(/\b(restaurant|food|pizza|coffee|lunch|dinner|breakfast)\b/i) ||
      lowerQuery.match(/\b(movie|film|show|tv|netflix|streaming)\b/i) ||
      lowerQuery.match(/\b(sports|game|score|team|player)\b/i) ||
      lowerQuery.match(/\b(store|shop|buy|purchase|price|sale)\b/i) ||
      lowerQuery.match(/\b(directions|map|route|traffic|drive|distance)\b/i) ||
      lowerQuery.match(/\b(recipe|cook|bake|ingredient)\b/i) ||
      lowerQuery.match(/\b(hotel|flight|travel|vacation|trip)\b/i)) {
    
    searchMode = 'general-web';
    siteRestrictions = ''; // NO site restrictions for general queries
    enhancedQuery = searchQuery; // Use original query as-is
    
    console.log(`General web query detected - NO site restrictions applied`);
  }
  // Tax-specific query patterns
  else if (lowerQuery.match(/\b(irs|internal revenue|tax|1040|1099|w-2|w-4|schedule [a-z])\b/i) ||
      lowerQuery.match(/\b(form \d{4}|publication \d+|revenue ruling|notice \d{4})\b/i) ||
      lowerQuery.match(/\b(deduction|credit|exemption|taxable|nontaxable)\b/i)) {
    
    searchMode = 'tax';
    
    // Check for specific form or publication
    if (lowerQuery.match(/form\s+\d{4}/i)) {
      siteRestrictions = 'site:irs.gov';
      enhancedQuery = `${searchQuery} PDF instructions`;
    } else if (lowerQuery.match(/publication\s+\d+/i)) {
      siteRestrictions = 'site:irs.gov';
      enhancedQuery = `${searchQuery} current year`;
    } else if (lowerQuery.includes('revenue ruling') || lowerQuery.includes('revenue procedure')) {
      siteRestrictions = 'site:irs.gov OR site:taxnotes.com';
      enhancedQuery = `${searchQuery} full text analysis`;
    } else {
      siteRestrictions = professionalSites.tax.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} ${new Date().getFullYear()} tax year`;
    }
    
    console.log(`Tax query detected, mode: ${searchMode}`);
  }
  // Accounting standards queries (GAAP, FASB, etc.)
  else if (lowerQuery.match(/\b(gaap|fasb|asc\s*\d+|accounting standard|gasb)\b/i) ||
           lowerQuery.match(/\b(revenue recognition|lease accounting|consolidation)\b/i)) {
    
    searchMode = 'accounting';
    
    if (lowerQuery.match(/asc\s*\d+/i)) {
      siteRestrictions = 'site:fasb.org OR site:aicpa.org';
      enhancedQuery = `${searchQuery} codification guidance implementation`;
    } else if (lowerQuery.includes('revenue recognition')) {
      siteRestrictions = 'site:fasb.org';
      enhancedQuery = `ASC 606 ${searchQuery}`;
    } else if (lowerQuery.includes('lease')) {
      siteRestrictions = 'site:fasb.org';
      enhancedQuery = `ASC 842 ${searchQuery}`;
    } else {
      siteRestrictions = professionalSites.accounting.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} GAAP accounting guidance`;
    }
    
    console.log(`Accounting standards query detected`);
  }
  // Audit and attestation queries
  else if (lowerQuery.match(/\b(pcaob|audit|sox|sarbanes|attestation|rsm|gam)\b/i) ||
           lowerQuery.match(/\b(internal control|material weakness|going concern)\b/i) ||
           lowerQuery.match(/\b(as \d{4}|au-c \d+|sqcs|isqm)\b/i)) {
    
    searchMode = 'audit';
    
    if (lowerQuery.match(/as\s*\d{4}/i)) {
      siteRestrictions = 'site:pcaobus.org';
      enhancedQuery = `${searchQuery} auditing standard`;
    } else if (lowerQuery.match(/au-c\s*\d+/i)) {
      siteRestrictions = 'site:aicpa.org';
      enhancedQuery = `${searchQuery} clarified auditing standards`;
    } else if (lowerQuery.includes('rsm')) {
      siteRestrictions = 'site:rsmus.com';
      enhancedQuery = `${searchQuery} audit methodology`;
    } else if (lowerQuery.includes('sox') || lowerQuery.includes('sarbanes')) {
      siteRestrictions = 'site:pcaobus.org OR site:sec.gov OR site:sox-online.com';
      enhancedQuery = `${searchQuery} compliance requirements section 404`;
    } else {
      siteRestrictions = professionalSites.audit.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} audit standards guidance`;
    }
    
    console.log(`Audit query detected`);
  }
  // Wealth management and investment queries
  else if (lowerQuery.match(/\b(401k|403b|ira|roth|pension|retirement)\b/i) ||
           lowerQuery.match(/\b(investment|portfolio|asset allocation|fiduciary)\b/i) ||
           lowerQuery.match(/\b(rmd|qcd|backdoor roth|mega backdoor)\b/i)) {
    
    searchMode = 'wealth';
    
    if (lowerQuery.match(/\b(401k|403b|ira|roth)\b/i)) {
      siteRestrictions = 'site:irs.gov OR site:kitces.com OR site:morningstar.com';
      enhancedQuery = `${searchQuery} ${new Date().getFullYear()} limits rules`;
    } else if (lowerQuery.includes('fiduciary')) {
      siteRestrictions = 'site:sec.gov OR site:finra.org OR site:cfainstitute.org';
      enhancedQuery = `${searchQuery} duty standard best interest`;
    } else if (lowerQuery.includes('rmd') || lowerQuery.includes('required minimum')) {
      siteRestrictions = 'site:irs.gov OR site:kitces.com';
      enhancedQuery = `${searchQuery} SECURE Act 2.0 age tables`;
    } else {
      siteRestrictions = professionalSites.wealthManagement.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} wealth management strategy`;
    }
    
    console.log(`Wealth management query detected`);
  }
  // Estate planning and trust queries
  else if (lowerQuery.match(/\b(estate|trust|probate|will|beneficiary)\b/i) ||
           lowerQuery.match(/\b(gift tax|estate tax|gst|generation skipping)\b/i) ||
           lowerQuery.match(/\b(irrevocable|revocable|qtip|grat|crut)\b/i)) {
    
    searchMode = 'estate';
    
    if (lowerQuery.match(/\b(estate tax|gift tax)\b/i)) {
      siteRestrictions = 'site:irs.gov OR site:actec.org';
      enhancedQuery = `${searchQuery} ${new Date().getFullYear()} exemption limits`;
    } else if (lowerQuery.match(/\b(grat|crut|clat|qtip)\b/i)) {
      siteRestrictions = 'site:actec.org OR site:americanbar.org';
      enhancedQuery = `${searchQuery} trust planning techniques`;
    } else {
      siteRestrictions = professionalSites.estatePlanning.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} estate planning`;
    }
    
    console.log(`Estate planning query detected`);
  }
  // Legal and regulatory queries
  else if (lowerQuery.match(/\b(legal|regulation|compliance|statute|usc|cfr)\b/i) ||
           lowerQuery.match(/\b(case law|precedent|ruling|decision)\b/i)) {
    
    searchMode = 'legal';
    
    if (lowerQuery.match(/\d+\s*usc\s*§?\s*\d+/i) || lowerQuery.match(/\d+\s*u\.s\.c\./i)) {
      siteRestrictions = 'site:law.cornell.edu OR site:justia.com';
      enhancedQuery = `${searchQuery} United States Code text`;
    } else if (lowerQuery.match(/\d+\s*cfr\s*§?\s*\d+/i) || lowerQuery.match(/\d+\s*c\.f\.r\./i)) {
      siteRestrictions = 'site:law.cornell.edu OR site:ecfr.gov';
      enhancedQuery = `${searchQuery} Code Federal Regulations`;
    } else {
      siteRestrictions = professionalSites.legal.map(site => `site:${site}`).join(' OR ');
      enhancedQuery = `${searchQuery} legal analysis`;
    }
    
    console.log(`Legal query detected`);
  }
  // CPA exam and professional education
  else if (lowerQuery.match(/\b(cpa exam|cpe|continuing education|aicpa ethics)\b/i) ||
           lowerQuery.match(/\b(far|aud|bec|reg|exam section)\b/i)) {
    
    searchMode = 'education';
    siteRestrictions = 'site:aicpa.org OR site:nasba.org OR site:thiswaytocpa.com';
    
    if (lowerQuery.match(/\b(far|aud|bec|reg)\b/i)) {
      enhancedQuery = `CPA exam ${searchQuery} study guide topics`;
    } else {
      enhancedQuery = `${searchQuery} CPA requirements`;
    }
    
    console.log(`CPA education query detected`);
  }
  // Default: Assume general web search unless clearly professional
  else {
    // Only apply professional sites if query contains strong professional indicators
    const strongProfessionalIndicators = 
      lowerQuery.match(/\b(tax return|tax planning|tax strategy|accounting policy|audit report|financial statement|wealth planning|estate plan)\b/i);
    
    if (strongProfessionalIndicators) {
      // This is likely professional, apply appropriate restrictions
      searchMode = 'professional-general';
      
      let relevantSites = [];
      if (lowerQuery.includes('tax')) relevantSites.push(...professionalSites.tax.slice(0, 3));
      if (lowerQuery.includes('audit')) relevantSites.push(...professionalSites.audit.slice(0, 3));
      if (lowerQuery.includes('account')) relevantSites.push(...professionalSites.accounting.slice(0, 3));
      
      if (relevantSites.length > 0) {
        relevantSites = [...new Set(relevantSites)].slice(0, 5);
        siteRestrictions = relevantSites.map(site => `site:${site}`).join(' OR ');
      }
      
      console.log(`Professional query detected with mixed sites`);
    } else {
      // Default to general web search - NO restrictions
      searchMode = 'general-web';
      siteRestrictions = ''; // IMPORTANT: No site restrictions
      enhancedQuery = searchQuery; // Use query as-is
      
      console.log(`General web search - no restrictions applied`);
    }
  }

  // Only add site restrictions if they were actually set
  if (siteRestrictions && siteRestrictions.length > 0) {
    enhancedQuery = `${enhancedQuery} (${siteRestrictions})`;
  }

  console.log(`Search mode: ${searchMode}`);
  console.log(`Final query: ${enhancedQuery}`);
  console.log(`Site restrictions: ${siteRestrictions || 'NONE'}`);

  // Azure Function URL and authentication
  const azureFunctionUrl = 'https://saxtech-docprocessor.azurewebsites.net/api/search/google';
  const functionKey = 'OmW6mL9GzRuMl6tuIqaPHOzvgpy_7zQpFaxgGu6JHS9qAzFuPqKigA==';
  
  // Build URL with query parameters
  const params = [
    `code=${encodeURIComponent(functionKey)}`,
    `q=${encodeURIComponent(enhancedQuery)}`,
    `limit=5`
  ].join('&');
  
  const fullUrl = `${azureFunctionUrl}?${params}`;
  
  console.log(`Calling Azure Function with query: ${enhancedQuery}`);
  
  const response = await this.helpers.httpRequest({
    method: 'GET',
    url: fullUrl,
    headers: {
      'Accept': 'application/json'
    },
    json: true,
    timeout: 10000 // 10 second timeout
  });

  console.log('Response received:', JSON.stringify(response).substring(0, 200));

  // Check if the response indicates an error
  if (response && response.success === false) {
    console.error('Azure Function returned error:', response.error);
    return `Search service error: ${response.error || 'Unknown error'}. Please try again.`;
  }

  // Handle the response
  if (!response || !response.results || response.results.length === 0) {
    return `No search results found for "${searchQuery}". Try using different search terms.`;
  }

  // Format results based on search mode
  let searchResults = '';
  
  if (searchMode === 'general-web') {
    searchResults = `🔍 **Web Search Results for "${searchQuery}"**:\n\n`;
  } else if (searchMode === 'professional-general') {
    searchResults = `🔍 **Professional Search Results**:\n\n`;
  } else {
    searchResults = `🔍 **${searchMode.charAt(0).toUpperCase() + searchMode.slice(1)} Search Results**:\n\n`;
  }
  
  let validResults = 0;

  response.results.forEach((item, index) => {
    const title = item.Title || item.title || 'No title';
    const snippet = item.Snippet || item.snippet || item.Description || '';
    const link = item.Link || item.link || item.url || '';
    
    if (!link) return;
    
    validResults++;
    
    // Add source type indicator for professional searches only
    let sourceType = '';
    if (searchMode !== 'general-web') {
      if (link.includes('.gov')) sourceType = ' [Official]';
      else if (link.includes('aicpa.org')) sourceType = ' [AICPA]';
      else if (link.includes('fasb.org')) sourceType = ' [FASB]';
      else if (link.includes('irs.gov')) sourceType = ' [IRS]';
      else if (link.includes('sec.gov')) sourceType = ' [SEC]';
    }
    
    searchResults += `**${validResults}. ${title}${sourceType}**\n`;
    
    if (snippet) {
      searchResults += `${snippet}\n`;
    }
    
    searchResults += `📎 ${link}\n\n`;
  });

  // Add appropriate footer based on search type
  if (searchMode === 'general-web') {
    searchResults += `\n📊 Found ${validResults} result${validResults !== 1 ? 's' : ''}`;
  } else if (searchMode === 'tax') {
    searchResults += `\n💡 Tax information current as of ${new Date().getFullYear()}. Verify for your specific situation.`;
  } else if (searchMode === 'audit' || searchMode === 'accounting') {
    searchResults += `\n💡 Standards may have updates. Check effective dates.`;
  }

  console.log(`Search completed: ${validResults} results returned`);

  return searchResults;

} catch (error) {
  console.error('Search error:', error);
  console.error('Error stack:', error.stack);
  
  if (error.message && error.message.includes('404')) {
    return `Search service not found. Error: ${error.message}`;
  } else if (error.message && error.message.includes('timeout')) {
    return `Search request timed out. Please try again.`;
  } else {
    return `Search failed: ${error.message || 'Unknown error'}. Please try again.`;
  }
}