// Combined Prepare and Build Context Node for n8n
// This handles the full MSAL userProfile data from the webhook

// Get the webhook data - handle both direct json and body structure
const inputData = $input.item.json.body || $input.item.json;

// Extract all data from webhook with defensive checks
const userProfile = inputData.userProfile || {};
const userContext = inputData.userContext || {};
const message = inputData.message || '';
const sessionId = inputData.sessionId || '';
const voice = inputData.voice || inputData.selectedVoice || 'sarah';
const enableTTS = inputData.enableTTS !== undefined ? inputData.enableTTS : true;
const attachments = inputData.attachments || [];
const profile = inputData.profile || 'sage';

// Build comprehensive personalized context from MSAL data with safe access
const personalizedContext = `USER PROFILE:
- Name: ${userProfile.name || 'Unknown'}
- Email: ${userProfile.email || userProfile.userPrincipalName || 'Unknown'}
- Job Title: ${userProfile.jobTitle || 'Not specified'}
- Department: ${userProfile.department || 'Not specified'}
- Company: ${userProfile.companyName || 'Not specified'}
- Office Location: ${userProfile.officeLocation || 'Not specified'}
- City: ${userProfile.city || 'Not specified'}
- State: ${userProfile.state || 'Not specified'}
- Country: ${userProfile.country || 'Not specified'}
- Manager: ${userProfile.manager?.name || 'N/A'}
- Mobile: ${userProfile.mobilePhone || 'Not provided'}
- Business Phones: ${userProfile.businessPhones?.join(', ') || 'None'}`;

// Determine permissions based on MSAL groups, roles, and job title
const groups = userProfile.groups || [];
const roles = userProfile.roles || [];
const jobTitle = (userProfile.jobTitle || '').toLowerCase();
const email = (userProfile.email || userProfile.userPrincipalName || '').toLowerCase();

const userPermissions = {
  canCreateUsers: roles.includes('User.ReadWrite.All') || jobTitle.includes('admin') || jobTitle.includes('director') || email === 'thughes@saxadvisorygroup.com',
  canResetPasswords: roles.includes('User.ReadWrite.All') || jobTitle.includes('it') || email === 'thughes@saxadvisorygroup.com',
  canAccessFinancials: groups.includes('Finance') || jobTitle.includes('finance') || jobTitle.includes('cfo'),
  canModifyPolicies: roles.includes('Policy.ReadWrite.All') || jobTitle.includes('director') || email === 'thughes@saxadvisorygroup.com',
  canViewAuditLogs: roles.includes('AuditLog.Read.All') || jobTitle.includes('audit'),
  canManageTeams: groups.includes('Managers') || jobTitle.includes('manager') || email === 'thughes@saxadvisorygroup.com',
  canAccessHR: groups.includes('HR') || jobTitle.includes('hr'),
  canAccessLegal: groups.includes('Legal') || jobTitle.includes('legal'),
  canAccessTax: groups.includes('Tax') || jobTitle.includes('tax') || jobTitle.includes('cpa'),
  isExecutive: groups.includes('Executives') || jobTitle.includes('chief') || jobTitle.includes('president') || email === 'thughes@saxadvisorygroup.com'
};

// Add permissions to context
let permissionsContext = `

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

// Department-specific instructions
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
  selectedVoice: voice,
  enableTTS: enableTTS,
  profile: profile,
  requestMetadata: {
    timestamp: new Date().toISOString(),
    department: userProfile.department || 'Unknown',
    jobTitle: userProfile.jobTitle || 'Unknown',
    tenantId: userProfile.tenantId || null,
    objectId: userProfile.objectId || null,
    hasManager: !!userProfile.manager,
    hasGroups: groups.length > 0,
    hasRoles: roles.length > 0,
    attachmentCount: attachments?.length || 0,
    authMethod: 'MSAL',
    webhookHeaders: $input.item.json.headers ? {
      origin: $input.item.json.headers.origin,
      realIp: $input.item.json.headers['x-real-ip']
    } : {}
  }
};

// Return array with json wrapper for Code node
return [{
  json: contextData
}];