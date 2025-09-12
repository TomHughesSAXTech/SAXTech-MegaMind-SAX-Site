// FIXES FOR N8N WORKFLOW CODE NODES
// These are the corrected versions of your code nodes that were causing errors

// ===========================================
// FIX 1: Build Context & Route nodes (multiple)
// ISSUE: Return value must be an array of objects
// ===========================================

// This is the CORRECTED version for ALL "Build Context & Route" nodes
// Replace the return statement in nodes: Build Context & Route1, Build Context & Route2, Build Context & Route4

const FIXED_BUILD_CONTEXT_ROUTE = `
const userProfile = $input.item.json.userProfile || {};
const userContext = $input.item.json.userContext || {};

let personalizedContext = 'Director of IT Operations at SAX Technology Advisors, managing 6 IT specialists, 20+ years experience with Azure infrastructure and ITIL automation';

if (userProfile.name) {
  personalizedContext = \`USER PROFILE:
- Name: \${userProfile.name}
- Role: \${userProfile.jobTitle || 'Director of IT Operations'}
- Department: \${userProfile.department || 'IT'}
- Contextual Role: \${userProfile.contextualRole || 'IT Leadership'}
- Email: \${userProfile.email || 'user@saxtechnology.com'}

USER PERMISSIONS:
- Create Users: \${userProfile.permissions?.canCreateUsers || true}
- Reset Passwords: \${userProfile.permissions?.canResetPasswords || true}
- Access Financials: \${userProfile.permissions?.canAccessFinancials || false}
- Modify Policies: \${userProfile.permissions?.canModifyPolicies || true}
- View Audit Logs: \${userProfile.permissions?.canViewAuditLogs || true}
- Manage Teams: \${userProfile.permissions?.canManageTeams || true}

CONTEXTUAL INSTRUCTIONS:
- Provide technical depth appropriate for IT leadership
- Include security implications and governance considerations
- Reference enterprise best practices and ITIL frameworks
- Always mention compliance and security implications for admin actions\`;
}

// Simple routing logic based on keywords
const message = $input.item.json.userMessage.toLowerCase();
let routedAgent = 'KnowledgeSearchAgent'; // default

if (message.includes('password') || message.includes('user') || message.includes('account') || message.includes('reset') || message.includes('create user') || message.includes('disable user') || message.includes('entra') || message.includes('azure ad')) {
  routedAgent = 'EntraAdminAgent';
} else if (message.includes('email') || message.includes('calendar') || message.includes('teams') || message.includes('meeting') || message.includes('onedrive') || message.includes('office') || message.includes('365')) {
  routedAgent = 'O365OperationsAgent';
} else if (message.includes('document') || message.includes('policy') || message.includes('report') || message.includes('create') || message.includes('write')) {
  routedAgent = 'DocumentCreationAgent';
} else if (message.includes('sop') || message.includes('documentation') || message.includes('itglue') || message.includes('procedure') || message.includes('guide')) {
  routedAgent = 'ITGlueDocumentationAgent';
} else if (message.includes('search') || message.includes('find') || message.includes('lookup') || message.includes('knowledge') || message.includes('information')) {
  routedAgent = 'KnowledgeSearchAgent';
}

// IMPORTANT: Return an ARRAY with the object inside
return [{
  json: {
    personalizedContext: personalizedContext,
    userMessage: $input.item.json.userMessage,
    sessionId: $input.item.json.sessionId,
    selectedVoice: $input.item.json.selectedVoice,
    userProfile: userProfile,
    routedAgent: routedAgent
  }
}];
`;

// ===========================================
// FIX 2: Format Request Body node
// ISSUE: Return value must be an array of objects
// ===========================================

const FIXED_FORMAT_REQUEST_BODY = `
// Prepare the request body for ElevenLabs API
const requestBody = {
  text: $json.textToSpeak || $json.response || 'Hello',
  model_id: $json.modelId || 'eleven_multilingual_v2',
  voice_settings: {
    stability: $json.stability || 0.75,
    similarity_boost: $json.similarity_boost || 0.75,
    style: $json.style || 0.5,
    use_speaker_boost: $json.use_speaker_boost !== false
  }
};

// IMPORTANT: Return an ARRAY with the object inside
return [{
  json: {
    ...($input.item.json),
    elevenLabsRequestBody: requestBody
  }
}];
`;

// ===========================================
// FIX 3: Build User Context node
// ISSUE: Syntax error - Extra closing parenthesis
// ===========================================

const FIXED_BUILD_USER_CONTEXT = `
// Complete Build Context Node for n8n Workflow
// This code processes user profile data from MSAL and prepares context for AI and ElevenLabs

// Extract user profile and context from webhook payload
// Handle both 'user' and 'userProfile' field names for flexibility
const userProfile = $input.item.json.userProfile || $input.item.json.user || {};
const userContext = $input.item.json.userContext || {};

// Check multiple possible message fields
const message = $input.item.json.message || 
                $input.item.json.body?.message || 
                $input.item.json.query || 
                $input.item.json.text || 
                $input.item.json.input || '';
const sessionId = $input.item.json.sessionId || 'session_' + Date.now();

// Default to 'sarah' for ElevenLabs (not 'alloy' which is OpenAI)
const rawVoice = $input.item.json.voice || $input.item.json.selectedVoice || 'sarah';
// Map 'alloy' to 'sarah' if it somehow gets through
const selectedVoice = rawVoice.toLowerCase() === 'alloy' ? 'sarah' : rawVoice;
const isPreview = $input.item.json.preview === true;
const attachments = $input.item.json.attachments || [];
// Enable TTS by default unless explicitly disabled
const enableTTS = $input.item.json.enableTTS !== false;

// Build comprehensive personalized context based on user profile
let personalizedContext = '';
let userPermissions = {};
let userPreferences = {};

// Check if we have a rich user profile from MSAL
if (userProfile.name || userProfile.displayName) {
  // Auto-detect department from job title if not provided
  if (!userProfile.department && userProfile.jobTitle) {
    const jobTitle = userProfile.jobTitle.toLowerCase();
    if (jobTitle.includes('it') || jobTitle.includes('technology') || jobTitle.includes('tech')) {
      userProfile.department = 'Information Technology';
    } else if (jobTitle.includes('finance') || jobTitle.includes('cfo')) {
      userProfile.department = 'Finance';
    } else if (jobTitle.includes('tax') || jobTitle.includes('cpa')) {
      userProfile.department = 'Tax';
    } else if (jobTitle.includes('audit')) {
      userProfile.department = 'Audit & Attestation';
    } else if (jobTitle.includes('hr') || jobTitle.includes('human')) {
      userProfile.department = 'Human Resources';
    } else if (jobTitle.includes('sales')) {
      userProfile.department = 'Sales';
    } else if (jobTitle.includes('marketing')) {
      userProfile.department = 'Marketing';
    } else if (jobTitle.includes('operations') || jobTitle.includes('director')) {
      userProfile.department = 'Operations';
    } else {
      userProfile.department = 'General';
    }
  }
  
  // Build detailed user context for AI
  personalizedContext = \`USER PROFILE:
- Name: \${userProfile.name || userProfile.displayName || 'Unknown'}
- Email: \${userProfile.email || userProfile.userPrincipalName || 'user@saxtechnology.com'}
- Job Title: \${userProfile.jobTitle || 'Employee'}
- Department: \${userProfile.department || 'General'}
- Company: \${userProfile.companyName || 'SAX Advisory Group'}
- Office Location: \${userProfile.officeLocation || 'Remote'}
- City: \${userProfile.city || ''}
- State: \${userProfile.state || ''}
- Country: \${userProfile.country || 'USA'}
- Timezone: \${userProfile.timezone || 'America/New_York'}\`;

  // Determine permissions based on job title and groups
  const jobTitle = (userProfile.jobTitle || '').toLowerCase();
  const groups = userProfile.groups || [];
  const roles = userProfile.roles || [];
  
  // Set permissions based on role
  userPermissions = {
    canCreateUsers: jobTitle.includes('admin') || jobTitle.includes('director') || jobTitle.includes('manager'),
    canResetPasswords: jobTitle.includes('it') || jobTitle.includes('admin') || jobTitle.includes('help'),
    canAccessFinancials: jobTitle.includes('finance') || jobTitle.includes('account') || jobTitle.includes('cfo') || jobTitle.includes('controller'),
    canModifyPolicies: jobTitle.includes('director') || jobTitle.includes('manager') || jobTitle.includes('admin'),
    canViewAuditLogs: jobTitle.includes('audit') || jobTitle.includes('compliance') || jobTitle.includes('security'),
    canManageTeams: jobTitle.includes('manager') || jobTitle.includes('director') || jobTitle.includes('lead'),
    canAccessHR: jobTitle.includes('hr') || jobTitle.includes('human') || jobTitle.includes('people'),
    canAccessLegal: jobTitle.includes('legal') || jobTitle.includes('counsel') || jobTitle.includes('attorney'),
    canAccessTax: jobTitle.includes('tax') || jobTitle.includes('cpa') || jobTitle.includes('accountant'),
    isExecutive: jobTitle.includes('chief') || jobTitle.includes('president') || jobTitle.includes('vp') || jobTitle.includes('vice president')
  };

  // Add permissions to context
  personalizedContext += \`

USER PERMISSIONS:
- Create Users: \${userPermissions.canCreateUsers}
- Reset Passwords: \${userPermissions.canResetPasswords}
- Access Financials: \${userPermissions.canAccessFinancials}
- Modify Policies: \${userPermissions.canModifyPolicies}
- View Audit Logs: \${userPermissions.canViewAuditLogs}
- Manage Teams: \${userPermissions.canManageTeams}
- Access HR Data: \${userPermissions.canAccessHR}
- Access Legal Docs: \${userPermissions.canAccessLegal}
- Access Tax Info: \${userPermissions.canAccessTax}
- Executive Access: \${userPermissions.isExecutive}\`;

} else {
  // Fallback context if no user profile is available
  personalizedContext = \`USER PROFILE:
- Name: Guest User
- Department: General
- Company: SAX Advisory Group

CONTEXTUAL INSTRUCTIONS:
- Provide professional, helpful responses
- Assume general business context
- Keep explanations clear and accessible
- Offer to provide more details if needed\`;
  
  userPermissions = {
    canCreateUsers: false,
    canResetPasswords: false,
    canAccessFinancials: false,
    canModifyPolicies: false,
    canViewAuditLogs: false,
    canManageTeams: false,
    canAccessHR: false,
    canAccessLegal: false,
    canAccessTax: false,
    isExecutive: false
  };
}

// Build the complete context object to return
const contextData = {
  // User message and session
  userMessage: message,
  sessionId: sessionId,
  
  // Complete personalized context for AI
  personalizedContext: personalizedContext,
  
  // User profile data
  userProfile: userProfile,
  userContext: userContext,
  userPermissions: userPermissions,
  
  // Voice configuration for ElevenLabs
  selectedVoice: selectedVoice,
  enableTTS: enableTTS,
  isPreview: isPreview,
  
  // Metadata
  requestMetadata: {
    timestamp: new Date().toISOString(),
    department: userProfile.department || 'General',
    jobTitle: userProfile.jobTitle || 'Employee',
    hasManager: !!userProfile.manager,
    hasGroups: (userProfile.groups || []).length > 0,
    hasRoles: (userProfile.roles || []).length > 0,
    attachmentCount: attachments.length
  }
};

// IMPORTANT: Return an ARRAY with the object inside
return [{
  json: contextData
}];
`;

// Export the fixes
module.exports = {
  FIXED_BUILD_CONTEXT_ROUTE,
  FIXED_FORMAT_REQUEST_BODY,
  FIXED_BUILD_USER_CONTEXT
};