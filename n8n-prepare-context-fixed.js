// Updated Prepare and Build Context Node for n8n
// No hardcoded users, no permissions system, department-aware contextual instructions
// FIXED: Added proper time awareness

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

// Get proper current time with full details
const now = new Date();
const timeString = now.toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

const currentHour = now.getHours();
let timeContext = '';
if (currentHour < 12) {
  timeContext = 'Morning';
} else if (currentHour < 17) {
  timeContext = 'Afternoon';
} else {
  timeContext = 'Evening';
}

// Build user profile context from MSAL/Azure AD data
const personalizedContext = `USER PROFILE:
- Name: ${userProfile.name || userProfile.displayName || 'Not provided'}
- Department: ${userProfile.department || 'Not specified'}
- Phone: ${userProfile.businessPhones?.join(', ') || userProfile.phone || 'Not provided'}
- Mobile: ${userProfile.mobilePhone || userProfile.mobile || 'Not provided'}
- Email: ${userProfile.email || userProfile.userPrincipalName || 'Not provided'}
- Title: ${userProfile.jobTitle || userProfile.title || 'Not specified'}
- Company: ${userProfile.companyName || userProfile.company || 'Not specified'}
- Manager: ${userProfile.manager?.name || userProfile.manager || 'Not specified'}
- Location: ${userProfile.officeLocation || userProfile.location || 'Not specified'}`;

// Department-specific contextual instructions (SHORTENED for conciseness)
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

// Shared Services
} else if (dept.includes('shared service')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR SHARED SERVICES:
- Focus on efficiency and standardization
- Reference SLAs and KPIs when relevant
- Be concise unless process detail is specifically requested`;

// Operations
} else if (dept.includes('operation')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR OPERATIONS:
- Focus on operational efficiency when relevant
- Include process improvements if applicable
- Be concise unless operational detail is specifically requested`;

// Billing Services
} else if (dept.includes('billing')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR BILLING SERVICES:
- Focus on accurate invoicing and collections
- Reference billing procedures when relevant
- Be concise unless billing detail is specifically requested`;

// Legal Department
} else if (dept.includes('legal')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR LEGAL:
- Focus on compliance and risk mitigation
- Reference legal requirements when applicable
- Be concise unless legal detail is specifically requested`;

// Client Accounting Services
} else if (dept.includes('client accounting') || dept.includes('cas')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR CLIENT ACCOUNTING SERVICES:
- Focus on client-specific needs
- Reference service agreements when relevant
- Be concise unless accounting detail is specifically requested`;

// Wealth Management
} else if (dept.includes('wealth')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR WEALTH MANAGEMENT:
- Focus on investment strategies when relevant
- Include compliance requirements if applicable
- Be concise unless investment detail is specifically requested`;

// Leadership
} else if (dept.includes('leadership') || dept.includes('executive')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR LEADERSHIP:
- Focus on strategic initiatives and KPIs
- Include executive-level insights when relevant
- Be concise and action-oriented`;

// Learning and Development
} else if (dept.includes('learning') || dept.includes('training') || dept.includes('development')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR LEARNING & DEVELOPMENT:
- Focus on skill development and training
- Reference learning methodologies when relevant
- Be concise unless training detail is specifically requested`;

// Marketing and Business Development
} else if (dept.includes('marketing') || dept.includes('business development') || dept.includes('sales')) {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS FOR MARKETING & BUSINESS DEVELOPMENT:
- Focus on market strategy and lead generation
- Include analytics and metrics when relevant
- Be concise unless marketing detail is specifically requested`;

// Generic fallback for unmatched departments
} else {
  departmentInstructions = `

CONTEXTUAL INSTRUCTIONS:
- Provide clear, professional responses
- Focus on practical solutions
- Be concise and actionable`;
}

// Combine all context with PROPER TIME
const completeContext = personalizedContext + departmentInstructions + `

IMPORTANT TIME & INTERACTION CONTEXT:
- Current Time: ${timeString}
- Time Period: ${timeContext}
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
5. Only elaborate when specifically asked for more detail`;

// Build the complete context object
const contextData = {
  userMessage: message,
  sessionId: sessionId,
  personalizedContext: completeContext,
  currentTime: timeString,  // Add explicit time field
  userProfile: {
    name: userProfile.name || userProfile.displayName,
    department: userProfile.department,
    email: userProfile.email || userProfile.userPrincipalName,
    title: userProfile.jobTitle || userProfile.title,
    company: userProfile.companyName || userProfile.company,
    location: userProfile.officeLocation || userProfile.location,
    manager: userProfile.manager?.name || userProfile.manager,
    phone: userProfile.businessPhones?.join(', ') || userProfile.phone,
    mobile: userProfile.mobilePhone || userProfile.mobile
  },
  userContext: userContext,
  selectedVoice: voice,
  enableTTS: enableTTS,
  profile: profile,
  attachments: attachments,
  requestMetadata: {
    timestamp: new Date().toISOString(),
    currentTimeFormatted: timeString,  // Add formatted time
    department: userProfile.department || 'Unknown',
    jobTitle: userProfile.jobTitle || userProfile.title || 'Unknown',
    tenantId: userProfile.tenantId || null,
    objectId: userProfile.objectId || userProfile.id || null,
    hasManager: !!(userProfile.manager?.name || userProfile.manager),
    attachmentCount: attachments?.length || 0,
    authMethod: 'MSAL/Azure AD',
    timeOfDay: timeContext,
    webhookHeaders: $input.item.json.headers ? {
      origin: $input.item.json.headers.origin,
      userAgent: $input.item.json.headers['user-agent'],
      realIp: $input.item.json.headers['x-real-ip'] || $input.item.json.headers['x-forwarded-for']
    } : {}
  }
};

// Return array with json wrapper for Code node
return [{
  json: contextData
}];