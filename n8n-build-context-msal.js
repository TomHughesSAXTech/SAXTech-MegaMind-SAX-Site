// Build Context from MSAL Data - No Fallbacks
// This processes the actual MSAL authenticated user profile

// Get the MSAL user profile data
const userProfile = $input.item.json.userProfile;
const userContext = $input.item.json.userContext;
const message = $input.item.json.message;
const sessionId = $input.item.json.sessionId;
const selectedVoice = $input.item.json.selectedVoice;
const enableTTS = $input.item.json.enableTTS;
const preview = $input.item.json.preview;
const attachments = $input.item.json.attachments;

// Build personalized context from MSAL data
const personalizedContext = `USER PROFILE:
- Name: ${userProfile.displayName}
- Email: ${userProfile.mail || userProfile.userPrincipalName}
- Job Title: ${userProfile.jobTitle}
- Department: ${userProfile.department}
- Company: ${userProfile.companyName}
- Office Location: ${userProfile.officeLocation}
- City: ${userProfile.city}
- State: ${userProfile.state}
- Country: ${userProfile.country}
- Manager: ${userProfile.manager?.displayName || 'N/A'}
- Employee ID: ${userProfile.employeeId}
- Mobile: ${userProfile.mobilePhone}
- Business Phones: ${userProfile.businessPhones?.join(', ')}`;

// Determine permissions based on MSAL groups and roles
const groups = userProfile.groups || [];
const roles = userProfile.roles || [];
const jobTitle = (userProfile.jobTitle || '').toLowerCase();

const userPermissions = {
  canCreateUsers: roles.includes('User.ReadWrite.All') || jobTitle.includes('admin') || jobTitle.includes('director'),
  canResetPasswords: roles.includes('User.ReadWrite.All') || jobTitle.includes('it'),
  canAccessFinancials: groups.includes('Finance') || jobTitle.includes('finance') || jobTitle.includes('cfo'),
  canModifyPolicies: roles.includes('Policy.ReadWrite.All') || jobTitle.includes('director'),
  canViewAuditLogs: roles.includes('AuditLog.Read.All') || jobTitle.includes('audit'),
  canManageTeams: groups.includes('Managers') || jobTitle.includes('manager'),
  canAccessHR: groups.includes('HR') || jobTitle.includes('hr'),
  canAccessLegal: groups.includes('Legal') || jobTitle.includes('legal'),
  canAccessTax: groups.includes('Tax') || jobTitle.includes('tax') || jobTitle.includes('cpa'),
  isExecutive: groups.includes('Executives') || jobTitle.includes('chief') || jobTitle.includes('president')
};

// Add permissions to context
const permissionsContext = `

USER PERMISSIONS:
- Create Users: ${userPermissions.canCreateUsers}
- Reset Passwords: ${userPermissions.canResetPasswords}
- Access Financials: ${userPermissions.canAccessFinancials}
- Modify Policies: ${userPermissions.canModifyPolicies}
- View Audit Logs: ${userPermissions.canViewAuditLogs}
- Manage Teams: ${userPermissions.canManageTeams}
- Access HR Data: ${userPermissions.canAccessHR}
- Access Legal Docs: ${userPermissions.canAccessLegal}
- Access Tax Info: ${userPermissions.canAccessTax}
- Executive Access: ${userPermissions.isExecutive}`;

// Add groups if present
let groupsContext = '';
if (groups.length > 0) {
  groupsContext = `

USER GROUPS:
${groups.map(g => `- ${g}`).join('\n')}`;
}

// Add roles if present
let rolesContext = '';
if (roles.length > 0) {
  rolesContext = `

USER ROLES:
${roles.map(r => `- ${r}`).join('\n')}`;
}

// Department-specific instructions based on MSAL data
const dept = (userProfile.department || '').toLowerCase();
let departmentInstructions = '';

if (dept.includes('it') || dept.includes('technology')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR IT:
- Provide technical depth and implementation details
- Include security implications and best practices
- Reference ITIL frameworks and enterprise standards
- Mention PowerShell commands and Azure CLI when relevant`;
} else if (dept.includes('finance')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR FINANCE:
- Focus on financial implications and ROI
- Include relevant accounting standards (GAAP, FASB)
- Reference tax codes and compliance requirements
- Provide budget impact analysis when relevant`;
} else if (dept.includes('hr') || dept.includes('human')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR HR:
- Focus on people management and organizational impact
- Include compliance with labor laws and regulations
- Reference employee handbook and company policies
- Maintain privacy and confidentiality requirements`;
} else if (dept.includes('audit')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR AUDIT:
- Reference relevant auditing standards (PCAOB, AICPA)
- Include internal control considerations
- Document findings with clear evidence
- Provide risk assessment perspectives`;
}

// Combine all context
const completeContext = personalizedContext + permissionsContext + groupsContext + rolesContext + departmentInstructions;

// Build the complete context object
const contextData = {
  userMessage: message,
  sessionId: sessionId,
  personalizedContext: completeContext,
  userProfile: userProfile,
  userContext: userContext,
  userPermissions: userPermissions,
  selectedVoice: selectedVoice,
  enableTTS: enableTTS,
  isPreview: preview,
  requestMetadata: {
    timestamp: new Date().toISOString(),
    department: userProfile.department,
    jobTitle: userProfile.jobTitle,
    hasManager: !!userProfile.manager,
    hasGroups: groups.length > 0,
    hasRoles: roles.length > 0,
    attachmentCount: attachments?.length || 0,
    authMethod: 'MSAL',
    tenantId: userProfile.tenantId
  }
};

// Return array with json wrapper for Code node
return [{
  json: contextData
}];