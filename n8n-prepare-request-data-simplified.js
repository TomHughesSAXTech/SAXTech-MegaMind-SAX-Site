// Simplified Prepare Request Data for n8n Set Node (Raw JSON Mode)
// This code works with n8n Set node with mode: "raw" and jsonOutput

// Get webhook data
const webhookData = $input.item.json;
const rawUser = webhookData.user || webhookData.userProfile || {};

// Build enriched profile
const enrichedUserProfile = {
  name: rawUser.name || 'Unknown User',
  displayName: rawUser.name || 'Unknown User',
  email: rawUser.email || 'user@saxtechnology.com',
  userPrincipalName: rawUser.email || 'user@saxtechnology.com',
  jobTitle: rawUser.jobTitle || 'Employee',
  department: rawUser.department || 'General',
  companyName: 'SAX Advisory Group',
  officeLocation: 'Remote',
  city: '',
  state: '',
  country: 'USA',
  timezone: 'America/New_York',
  groups: [],
  roles: []
};

// Special handling for Tom Hughes
if (rawUser.email === 'thughes@saxadvisorygroup.com') {
  enrichedUserProfile.jobTitle = 'IT Director';
  enrichedUserProfile.department = 'Information Technology';
}

// Build result object
const result = {
  userProfile: enrichedUserProfile,
  userContext: {},
  message: webhookData.message || '',
  sessionId: webhookData.sessionId || 'session_' + Date.now(),
  voice: webhookData.voice || 'sarah',
  selectedVoice: webhookData.voice || 'sarah',
  enableTTS: webhookData.enableTTS !== false,
  preview: webhookData.preview === true,
  attachments: webhookData.attachments || []
};

// For Set node with raw JSON mode, just return the object
return result;