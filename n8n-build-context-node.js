// Complete Build Context Node for n8n Workflow
// This code goes in the "Build Context" Code node in your n8n workflow
// It processes user profile data from MSAL and prepares context for AI and ElevenLabs

// Extract user profile and context from webhook payload
const userProfile = $input.item.json.userProfile || {};
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
  personalizedContext = `USER PROFILE:
- Name: ${userProfile.name || userProfile.displayName}
- Email: ${userProfile.email || userProfile.userPrincipalName || 'user@saxtechnology.com'}
- Job Title: ${userProfile.jobTitle || 'Employee'}
- Department: ${userProfile.department || 'General'}
- Company: ${userProfile.companyName || 'SAX Advisory Group'}
- Office Location: ${userProfile.officeLocation || 'Remote'}
- City: ${userProfile.city || ''}
- State: ${userProfile.state || ''}
- Country: ${userProfile.country || 'USA'}
- Timezone: ${userProfile.timezone || 'America/New_York'}`;

  // Add manager information if available
  if (userProfile.manager) {
    personalizedContext += `
- Manager: ${userProfile.manager.name} (${userProfile.manager.jobTitle || 'Manager'})
- Manager Email: ${userProfile.manager.email || ''}`;
  }

  // Add organizational context
  if (userProfile.objectId || userProfile.id) {
    personalizedContext += `
- User ID: ${userProfile.objectId || userProfile.id}
- Tenant ID: ${userProfile.tenantId || ''}`;
  }

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
  personalizedContext += `

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

  // Add group memberships if available
  if (groups.length > 0) {
    personalizedContext += `

USER GROUPS:
${groups.map(g => `- ${g}`).join('\n')}`;
  }

  // Add roles if available
  if (roles.length > 0) {
    personalizedContext += `

USER ROLES:
${roles.map(r => `- ${r}`).join('\n')}`;
  }

  // Department-specific instructions
  let departmentInstructions = '';
  const dept = (userProfile.department || '').toLowerCase();
  
  if (dept.includes('it') || dept.includes('tech')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR IT:
- Provide technical depth and implementation details
- Include security implications and best practices
- Reference ITIL frameworks and enterprise standards
- Mention PowerShell commands and Azure CLI when relevant
- Include links to technical documentation`;
  } else if (dept.includes('finance') || dept.includes('account')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR FINANCE:
- Focus on financial implications and ROI
- Include relevant accounting standards (GAAP, FASB)
- Reference tax codes and compliance requirements
- Provide budget impact analysis when relevant
- Use financial terminology appropriately`;
  } else if (dept.includes('hr') || dept.includes('human')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR HR:
- Focus on people management and organizational impact
- Include compliance with labor laws and regulations
- Reference employee handbook and company policies
- Provide clear, empathetic communication
- Consider privacy and confidentiality requirements`;
  } else if (dept.includes('sales') || dept.includes('marketing')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR SALES/MARKETING:
- Focus on customer impact and revenue implications
- Include market trends and competitive analysis
- Reference CRM data and sales metrics
- Provide actionable insights for growth
- Use persuasive and engaging language`;
  } else if (dept.includes('legal')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR LEGAL:
- Include relevant statutes and regulations
- Reference case law and precedents when applicable
- Maintain precision in legal terminology
- Consider risk and liability implications
- Provide clear documentation requirements`;
  } else if (dept.includes('audit')) {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS FOR AUDIT:
- Reference relevant auditing standards (PCAOB, AICPA)
- Include internal control considerations
- Document findings with clear evidence
- Provide risk assessment perspectives
- Maintain objectivity and independence`;
  } else {
    departmentInstructions = `
CONTEXTUAL INSTRUCTIONS:
- Provide clear, professional responses
- Adapt technical level to user's background
- Include relevant examples and best practices
- Be concise but comprehensive`;
  }
  
  personalizedContext += departmentInstructions;

  // Add job-level specific guidance
  if (userPermissions.isExecutive) {
    personalizedContext += `

EXECUTIVE LEVEL GUIDANCE:
- Provide strategic insights and high-level summaries
- Include KPIs and metrics that matter to leadership
- Focus on business impact and ROI
- Offer decision-support information
- Keep responses concise with option to drill down`;
  } else if (jobTitle.includes('manager')) {
    personalizedContext += `

MANAGER LEVEL GUIDANCE:
- Balance strategic and tactical information
- Include team management considerations
- Provide actionable recommendations
- Reference departmental goals and objectives
- Include resource and timeline implications`;
  } else if (jobTitle.includes('analyst') || jobTitle.includes('specialist')) {
    personalizedContext += `

SPECIALIST LEVEL GUIDANCE:
- Provide detailed technical information
- Include step-by-step instructions when needed
- Reference specific tools and systems
- Offer troubleshooting guidance
- Include links to detailed documentation`;
  }

} else {
  // Fallback context if no user profile is available
  personalizedContext = `USER PROFILE:
- Name: Guest User
- Department: General
- Company: SAX Advisory Group

CONTEXTUAL INSTRUCTIONS:
- Provide professional, helpful responses
- Assume general business context
- Keep explanations clear and accessible
- Offer to provide more details if needed`;
  
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

// Add session context
if (userContext.browser || userContext.language) {
  personalizedContext += `

SESSION CONTEXT:
- Browser: ${userContext.browser || 'Unknown'}
- Language: ${userContext.language || 'en-US'}
- Platform: ${userContext.platform || 'Unknown'}
- Screen: ${userContext.screenResolution || 'Unknown'}
- Session Duration: ${Math.round((userContext.sessionDuration || 0) / 60000)} minutes
- Previous Messages: ${userContext.previousMessages || 0}`;
}

// Add current request context
personalizedContext += `

CURRENT REQUEST:
- Message: "${message}"
- Session ID: ${sessionId}
- Timestamp: ${new Date().toISOString()}
- Has Attachments: ${attachments.length > 0}`;

if (attachments.length > 0) {
  personalizedContext += `
- Attachments: ${attachments.map(a => `${a.name} (${a.type})`).join(', ')}`;
}

// Prepare ElevenLabs voice configuration
const voiceConfig = {
  // Map friendly voice names to ElevenLabs voice IDs
  voiceId: {
    'sarah': 'EXAVITQu4vr4xnSDxMaL',      // Sarah - Professional female
    'adam': 'pNInz6obpgDQGcFmaJgB',       // Adam - Professional male
    'rachel': '21m00Tcm4TlvDq8ikWAM',     // Rachel - Calm female
    'bella': 'EXAVITQu4vr4xnSDxMaL',      // Bella - Friendly female
    'emily': 'MF3mGyEYCl7XYWbV9V6O',      // Emily - British female
    'domi': 'AZnzlk1XvdvUeBnXmlld',       // Domi - Young male
    'antoni': 'ErXwobaYiN019PkySvjV',     // Antoni - Professional male
    'josh': 'TxGEqnHWrfWFTfGW9XjX',       // Josh - Young male
    'arnold': 'VR6AewLTigWG4xSOukaG',     // Arnold - Deep male
    'sam': 'yoZ06aMxZJJ28mfd3POQ',        // Sam - Neutral
    'elli': 'MF3mGyEYCl7XYWbV9V6O',       // Elli - Alternative female
    'nicole': 'piTKgcLEGmPE4e6mEKli',     // Nicole - Whisper female
    'alloy': 'EXAVITQu4vr4xnSDxMaL'      // Default to Sarah
  }[selectedVoice.toLowerCase()] || 'EXAVITQu4vr4xnSDxMaL',
  
  // Voice model selection
  modelId: 'eleven_multilingual_v2',
  
  // Voice settings optimized for business context
  voiceSettings: {
    stability: 0.75,        // Consistent tone
    similarity_boost: 0.75, // Natural voice matching
    style: 0.5,            // Balanced expression
    use_speaker_boost: true // Enhanced clarity
  },
  
  // Additional voice preferences based on context
  voicePreferences: {
    speed: 1.0,            // Normal speed
    pitch: 1.0,            // Normal pitch
    emphasis: 'moderate'    // Moderate emphasis
  }
};

// Adjust voice settings based on department/role
const deptForVoice = (userProfile.department || '').toLowerCase();
if (userPermissions.isExecutive) {
  voiceConfig.voiceSettings.style = 0.3;      // More formal
  voiceConfig.voiceSettings.stability = 0.85; // Very consistent
} else if (deptForVoice.includes('sales') || deptForVoice.includes('marketing')) {
  voiceConfig.voiceSettings.style = 0.7;      // More expressive
  voiceConfig.voiceSettings.stability = 0.65; // More dynamic
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
  voiceId: voiceConfig.voiceId,
  modelId: voiceConfig.modelId,
  voiceSettings: voiceConfig.voiceSettings,
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
    attachmentCount: attachments.length,
    sessionDuration: userContext.sessionDuration || 0,
    messageCount: userContext.previousMessages || 0
  },
  
  // System prompt additions based on context
  systemPromptAdditions: `
You are assisting ${userProfile.name || 'a SAX Advisory Group employee'} from the ${userProfile.department || 'General'} department.
${userProfile.jobTitle ? `Their role is: ${userProfile.jobTitle}.` : ''}
${userProfile.manager ? `They report to ${userProfile.manager.name}.` : ''}

Tailor your responses to their role and department. Be professional, helpful, and provide information appropriate to their access level and responsibilities.

Current session has ${userContext.previousMessages || 0} previous messages over ${Math.round((userContext.sessionDuration || 0) / 60000)} minutes.
User is located in ${userProfile.city || 'unknown city'}, ${userProfile.state || 'unknown state'} (Timezone: ${userProfile.timezone || 'America/New_York'}).

Remember to:
1. Use appropriate technical depth based on their department and role
2. Reference relevant policies, procedures, and best practices for their area
3. Provide actionable insights aligned with their responsibilities
4. Maintain appropriate confidentiality based on their access level
5. Format responses professionally with clear structure

Voice output is ${enableTTS ? 'ENABLED' : 'DISABLED'} using ${selectedVoice} voice.`
};

// Log the context for debugging
console.log('Build Context Output:', {
  user: userProfile.name || 'Unknown',
  department: userProfile.department || 'Unknown',
  jobTitle: userProfile.jobTitle || 'Unknown',
  voiceEnabled: enableTTS,
  selectedVoice: selectedVoice,
  messageLength: message.length,
  hasAttachments: attachments.length > 0
});

// Return the complete context
return contextData;