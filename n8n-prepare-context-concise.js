// Prepare Context node - Concise version with time awareness
// This goes in your n8n "Prepare Context" Code node

// Get input data
const inputData = $input.all()[0].json;
const userProfile = inputData.userProfile || {};
const sessionId = inputData.sessionId;
const message = inputData.message;

// Extract essential user info only
const userName = userProfile.displayName || 'User';
const userEmail = userProfile.mail || userProfile.userPrincipalName || '';
const department = userProfile.department || 'General';
const jobTitle = userProfile.jobTitle || '';

// Very concise department context
const departmentContext = {
  'IT': `Tech-focused user.`,
  'Finance': `Finance-focused user.`,
  'HR': `HR-focused user.`,
  'Legal': `Legal-focused user.`,
  'Operations': `Operations-focused user.`,
  'Audit': `Audit-focused user.`,
  'BPO': `BPO-focused user.`,
  'Tax': `Tax-focused user.`,
  'General': ``
};

// Get current timestamp for context
const currentTime = new Date().toLocaleString('en-US', { 
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true
});

// Build minimal context
const context = {
  user: {
    name: userName,
    email: userEmail,
    department: department,
    jobTitle: jobTitle
  },
  session: {
    id: sessionId,
    timestamp: currentTime,
    timeNote: `Current time: ${currentTime}. Use this for appropriate greetings.`
  },
  departmentContext: departmentContext[department] || '',
  instructions: `Be concise and helpful. The current time is ${currentTime} - use appropriate greetings based on time of day.`
};

// Return the prepared context
return {
  json: {
    message: message,
    context: context,
    sessionId: sessionId
  }
};