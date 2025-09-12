// Prepare Request Data Node for n8n Workflow
// This node enriches the webhook data before passing to Build Context
// Place this between your Webhook node and Build Context node

// Extract the incoming webhook data
const webhookData = $input.item.json;

// Extract user data from either 'user' or 'userProfile' field
const rawUser = webhookData.user || webhookData.userProfile || {};

// Create enriched user profile with default values for missing fields
const enrichedUserProfile = {
  // Basic identification
  name: rawUser.name || rawUser.displayName || 'Unknown User',
  displayName: rawUser.displayName || rawUser.name || 'Unknown User',
  email: rawUser.email || rawUser.userPrincipalName || rawUser.mail || 'user@saxtechnology.com',
  userPrincipalName: rawUser.userPrincipalName || rawUser.email || 'user@saxtechnology.com',
  
  // Professional information
  jobTitle: rawUser.jobTitle || rawUser.title || 'Employee',
  department: rawUser.department || 'General',
  companyName: rawUser.companyName || rawUser.company || 'SAX Advisory Group',
  
  // Location information
  officeLocation: rawUser.officeLocation || rawUser.office || 'Remote',
  city: rawUser.city || '',
  state: rawUser.state || '',
  country: rawUser.country || 'USA',
  timezone: rawUser.timezone || 'America/New_York',
  
  // Additional Azure AD / Entra ID fields if available
  objectId: rawUser.objectId || rawUser.id || null,
  tenantId: rawUser.tenantId || null,
  
  // Manager information if available
  manager: rawUser.manager || null,
  
  // Groups and roles if available
  groups: rawUser.groups || [],
  roles: rawUser.roles || []
};

// Attempt to auto-detect department from email domain if not provided
if (enrichedUserProfile.department === 'General' && enrichedUserProfile.email) {
  const email = enrichedUserProfile.email.toLowerCase();
  
  // Check for department hints in email
  if (email.includes('it@') || email.includes('tech@') || email.includes('support@')) {
    enrichedUserProfile.department = 'Information Technology';
  } else if (email.includes('finance@') || email.includes('accounting@')) {
    enrichedUserProfile.department = 'Finance';
  } else if (email.includes('hr@') || email.includes('people@')) {
    enrichedUserProfile.department = 'Human Resources';
  } else if (email.includes('sales@')) {
    enrichedUserProfile.department = 'Sales';
  } else if (email.includes('marketing@')) {
    enrichedUserProfile.department = 'Marketing';
  }
  
  // Check for special email addresses
  if (email === 'thughes@saxadvisorygroup.com') {
    enrichedUserProfile.jobTitle = 'IT Director';
    enrichedUserProfile.department = 'Information Technology';
  }
}

// Create enriched user context with session information
const enrichedUserContext = webhookData.userContext || {
  browser: webhookData.browser || 'Unknown',
  language: webhookData.language || 'en-US',
  platform: webhookData.platform || 'Unknown',
  screenResolution: webhookData.screenResolution || 'Unknown',
  sessionDuration: 0,
  previousMessages: 0
};

// Build the complete enriched request data
const enrichedRequestData = {
  // Preserve all original webhook data
  ...webhookData,
  
  // Override with enriched user profile
  userProfile: enrichedUserProfile,
  userContext: enrichedUserContext,
  
  // Ensure all expected fields exist
  message: webhookData.message || webhookData.query || webhookData.text || '',
  sessionId: webhookData.sessionId || 'session_' + Date.now(),
  voice: webhookData.voice || webhookData.selectedVoice || 'sarah',
  enableTTS: webhookData.enableTTS !== false, // Default to true
  preview: webhookData.preview === true, // Default to false
  attachments: webhookData.attachments || [],
  
  // Add any additional metadata
  requestMetadata: {
    originalSource: 'webhook',
    enrichedAt: new Date().toISOString(),
    hasUserProfile: !!rawUser.name || !!rawUser.email,
    profileSource: rawUser.name ? 'provided' : 'defaulted'
  }
};

// Log the enrichment for debugging
console.log('Request Data Enrichment:', {
  originalUser: rawUser,
  enrichedUser: enrichedUserProfile.name,
  department: enrichedUserProfile.department,
  jobTitle: enrichedUserProfile.jobTitle,
  enableTTS: enrichedRequestData.enableTTS,
  voice: enrichedRequestData.voice
});

// Return the enriched data as JSON for the Set node
// The Set node with mode: "raw" expects the data to be returned as-is
return enrichedRequestData;
