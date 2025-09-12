// Fixed Build User Context Node for n8n
// This fixes the "Syntax error: Extra closing parenthesis" issue

// Extract user profile and context from input
const userProfile = $input.item.json.userProfile || $input.item.json.user || {};
const userContext = $input.item.json.userContext || {};

// Get message from various possible fields
const message = $input.item.json.message || 
                $input.item.json.body?.message || 
                $input.item.json.query || 
                $input.item.json.text || 
                $input.item.json.input || '';

const sessionId = $input.item.json.sessionId || 'session_' + Date.now();
const selectedVoice = $input.item.json.voice || $input.item.json.selectedVoice || 'sarah';
const enableTTS = $input.item.json.enableTTS !== false;
const isPreview = $input.item.json.preview === true;
const attachments = $input.item.json.attachments || [];

// Build personalized context
let personalizedContext = '';
let userPermissions = {};

// Check if we have user profile data
if (userProfile.name || userProfile.displayName) {
  // Set department if not provided
  if (!userProfile.department) {
    if (userProfile.email === 'thughes@saxadvisorygroup.com') {
      userProfile.department = 'Information Technology';
      userProfile.jobTitle = 'IT Director';
    } else {
      userProfile.department = 'General';
    }
  }
  
  // Build user context string
  personalizedContext = `USER PROFILE:
- Name: ${userProfile.name || userProfile.displayName}
- Email: ${userProfile.email || 'user@saxtechnology.com'}
- Job Title: ${userProfile.jobTitle || 'Employee'}
- Department: ${userProfile.department || 'General'}
- Company: ${userProfile.companyName || 'SAX Advisory Group'}`;

  // Set permissions based on role
  const jobTitle = (userProfile.jobTitle || '').toLowerCase();
  userPermissions = {
    canCreateUsers: jobTitle.includes('director') || jobTitle.includes('admin'),
    canResetPasswords: jobTitle.includes('it') || jobTitle.includes('admin'),
    canAccessFinancials: jobTitle.includes('finance') || jobTitle.includes('cfo'),
    canModifyPolicies: jobTitle.includes('director') || jobTitle.includes('manager'),
    canViewAuditLogs: jobTitle.includes('audit') || jobTitle.includes('compliance'),
    canManageTeams: jobTitle.includes('manager') || jobTitle.includes('director'),
    isExecutive: jobTitle.includes('chief') || jobTitle.includes('director')
  };

} else {
  // Default context for unknown users
  personalizedContext = `USER PROFILE:
- Name: Guest User
- Department: General
- Company: SAX Advisory Group`;
  
  userPermissions = {
    canCreateUsers: false,
    canResetPasswords: false,
    canAccessFinancials: false,
    canModifyPolicies: false,
    canViewAuditLogs: false,
    canManageTeams: false,
    isExecutive: false
  };
}

// Build the context data object
const contextData = {
  userMessage: message,
  sessionId: sessionId,
  personalizedContext: personalizedContext,
  userProfile: userProfile,
  userContext: userContext,
  userPermissions: userPermissions,
  selectedVoice: selectedVoice,
  enableTTS: enableTTS,
  isPreview: isPreview,
  requestMetadata: {
    timestamp: new Date().toISOString(),
    department: userProfile.department || 'General',
    jobTitle: userProfile.jobTitle || 'Employee',
    attachmentCount: attachments.length
  }
};

// IMPORTANT: For Code nodes, return an array with json wrapper
return [{
  json: contextData
}];