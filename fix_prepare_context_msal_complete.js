// COMPLETE FIX for Prepare Context and Route Node
// This properly extracts ALL MSAL data from the webhook
// Version: 2.0 - Full MSAL data extraction
// Last Updated: 2025-09-13

// Get the webhook data - handle both direct json and body structure
const inputData = $input.item.json.body || $input.item.json;

// Extract all data from webhook with comprehensive checks
const userProfile = inputData.userProfile || {};
const userContext = inputData.userContext || {};
const message = inputData.message || '';
const sessionId = inputData.sessionId || '';
const voice = inputData.voice || inputData.selectedVoice || 'sarah';
const enableTTS = inputData.enableTTS !== undefined ? inputData.enableTTS : true;
const attachments = inputData.attachments || [];
const profile = inputData.profile || 'sage';

// Get proper current time with full details
const timezone = userProfile.timezone || userContext.timezone || inputData.timezone || inputData.userTimezone || 'UTC';
const now = new Date();
const timeString = now.toLocaleString('en-US', {
  timeZone: timezone,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

// Get hour in user's timezone for proper greeting
const userHour = parseInt(now.toLocaleString('en-US', {
  timeZone: timezone,
  hour: 'numeric',
  hour12: false
}));

let timeContext = '';
if (userHour < 12) {
  timeContext = 'Morning';
} else if (userHour < 17) {
  timeContext = 'Afternoon';
} else {
  timeContext = 'Evening';
}

// Build COMPLETE user profile context with ALL MSAL fields
const personalizedContext = `USER PROFILE:
- Name: ${userProfile.name || userProfile.displayName || 'Not provided'}
- Given Name: ${userProfile.givenName || 'Not provided'}
- Surname: ${userProfile.surname || 'Not provided'}
- Email: ${userProfile.email || userProfile.mail || userProfile.userPrincipalName || 'Not provided'}
- User Principal Name: ${userProfile.userPrincipalName || 'Not provided'}

JOB INFORMATION:
- Job Title: ${userProfile.jobTitle || 'Not specified'}
- Department: ${userProfile.department || 'Not specified'}
- Company: ${userProfile.companyName || 'SAX Advisory Group'}
- Office Location: ${userProfile.officeLocation || 'Not specified'}

CONTACT INFORMATION:
- Business Phones: ${userProfile.businessPhones?.join(', ') || 'Not provided'}
- Mobile Phone: ${userProfile.mobilePhone || 'Not provided'}

LOCATION:
- City: ${userProfile.city || 'Not specified'}
- State: ${userProfile.state || 'Not specified'}
- Country: ${userProfile.country || 'Not specified'}

ORGANIZATIONAL:
- Manager: ${userProfile.manager?.name || 'Not specified'}
- Manager Email: ${userProfile.manager?.email || 'Not specified'}
- Manager Title: ${userProfile.manager?.jobTitle || 'Not specified'}

SECURITY CONTEXT:
- Object ID: ${userProfile.objectId || userProfile.id || 'Not available'}
- Tenant ID: ${userProfile.tenantId || 'Not available'}
- Groups: ${userProfile.groups?.length > 0 ? userProfile.groups.join(', ') : 'None'}
- Roles: ${userProfile.roles?.length > 0 ? userProfile.roles.join(', ') : 'None'}`;

// Department-specific contextual instructions
const dept = (userProfile.department || '').toLowerCase();
let departmentInstructions = '';

// IT Department
if (dept.includes('it') || dept.includes('technology') || dept.includes('information')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR IT:
- Provide technical solutions with implementation details when asked
- Include security best practices when relevant
- Be concise unless technical depth is specifically requested`;

// Finance Department
} else if (dept.includes('finance') || dept.includes('financial')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR FINANCE:
- Focus on financial implications and ROI when relevant
- Reference accounting standards if applicable
- Be concise unless financial detail is specifically requested`;

// Tax Department
} else if (dept.includes('tax')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR TAX:
- Reference tax codes and regulations when applicable
- Include compliance requirements if relevant
- Be concise unless tax detail is specifically requested`;

// Audit Department
} else if (dept.includes('audit')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR AUDIT & ATTESTATION:
- Reference auditing standards when applicable
- Focus on risk and controls if relevant
- Be concise unless audit detail is specifically requested`;

// HR Department
} else if (dept.includes('hr') || dept.includes('human resource')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR HR:
- Maintain confidentiality for employee information
- Reference policies and compliance when relevant
- Be concise unless HR detail is specifically requested`;

// Generic fallback for unmatched departments
} else {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS:
- Provide clear, professional responses
- Focus on practical solutions
- Be concise and actionable`;
}

// Combine all context
const completeContext = personalizedContext + departmentInstructions + `

IMPORTANT TIME & INTERACTION CONTEXT:
- Current Time: ${timeString}
- Time Period: ${timeContext}
- User Timezone: ${timezone}
- Session ID: ${sessionId}
- Has Attachments: ${attachments.length > 0 ? 'Yes (' + attachments.length + ' files)' : 'No'}
- Voice Preference: ${voice}
- TTS Enabled: ${enableTTS}
- Profile Type: ${profile}

RESPONSE INSTRUCTIONS:
1. Use the current time (${timeString}) for appropriate greetings
2. Be CONCISE - keep initial responses brief unless detail is requested
3. If it's evening (after 5pm) say "Good evening", if morning say "Good morning", etc.
4. Don't provide lengthy context dumps - answer the question directly
5. Only elaborate when specifically asked for more detail
6. When asked about contact information, ALWAYS provide both mobile and business phones if available`;

// Build the complete context object with ALL fields
const contextData = {
  userMessage: message,
  sessionId: sessionId,
  personalizedContext: completeContext,
  currentTime: timeString,
  userProfile: {
    // Basic Info
    name: userProfile.name || userProfile.displayName,
    givenName: userProfile.givenName,
    surname: userProfile.surname,
    email: userProfile.email || userProfile.mail || userProfile.userPrincipalName,
    userPrincipalName: userProfile.userPrincipalName,
    
    // Job Info
    jobTitle: userProfile.jobTitle,
    department: userProfile.department,
    companyName: userProfile.companyName || 'SAX Advisory Group',
    officeLocation: userProfile.officeLocation,
    
    // Contact Info - IMPORTANT: Include both phone types
    businessPhones: userProfile.businessPhones || [],
    mobilePhone: userProfile.mobilePhone || '',
    phone: userProfile.businessPhones?.join(', ') || '',  // Legacy field
    mobile: userProfile.mobilePhone || '',  // Legacy field
    
    // Location
    city: userProfile.city,
    state: userProfile.state,
    country: userProfile.country,
    location: userProfile.officeLocation || userProfile.city || userProfile.state,
    
    // Organizational
    manager: userProfile.manager?.name || userProfile.manager,
    managerEmail: userProfile.manager?.email,
    managerTitle: userProfile.manager?.jobTitle,
    
    // Security Context
    objectId: userProfile.objectId || userProfile.id,
    tenantId: userProfile.tenantId,
    groups: userProfile.groups || [],
    roles: userProfile.roles || []
  },
  userContext: {
    ...userContext,
    sessionDuration: userContext.sessionDuration || 0,
    previousMessages: userContext.previousMessages || 0,
    browser: userContext.browser,
    language: userContext.language,
    platform: userContext.platform,
    screenResolution: userContext.screenResolution
  },
  selectedVoice: voice,
  enableTTS: enableTTS,
  profile: profile,
  attachments: attachments,
  requestMetadata: {
    timestamp: new Date().toISOString(),
    currentTimeFormatted: timeString,
    department: userProfile.department || 'Unknown',
    jobTitle: userProfile.jobTitle || 'Unknown',
    tenantId: userProfile.tenantId || null,
    objectId: userProfile.objectId || userProfile.id || null,
    hasManager: !!(userProfile.manager?.name || userProfile.manager),
    attachmentCount: attachments?.length || 0,
    authMethod: 'MSAL/Azure AD',
    timeOfDay: timeContext,
    hasMobilePhone: !!userProfile.mobilePhone,
    hasBusinessPhones: !!(userProfile.businessPhones && userProfile.businessPhones.length > 0),
    phoneCount: (userProfile.businessPhones?.length || 0) + (userProfile.mobilePhone ? 1 : 0),
    webhookHeaders: $input.item.json.headers ? {
      origin: $input.item.json.headers.origin,
      userAgent: $input.item.json.headers['user-agent'],
      realIp: $input.item.json.headers['x-real-ip'] || $input.item.json.headers['x-forwarded-for']
    } : {}
  }
};

// Debug logging to verify all data is captured
console.log('=== USER PROFILE DATA EXTRACTION ===');
console.log('Name:', contextData.userProfile.name);
console.log('Email:', contextData.userProfile.email);
console.log('Job Title:', contextData.userProfile.jobTitle);
console.log('Department:', contextData.userProfile.department);
console.log('Mobile Phone:', contextData.userProfile.mobilePhone || 'NOT PROVIDED');
console.log('Business Phones:', contextData.userProfile.businessPhones);
console.log('Has Mobile:', contextData.requestMetadata.hasMobilePhone);
console.log('Has Business Phones:', contextData.requestMetadata.hasBusinessPhones);
console.log('Total Phone Numbers:', contextData.requestMetadata.phoneCount);
console.log('=====================================');

// Return array with json wrapper for Code node
return [{
  json: contextData
}];