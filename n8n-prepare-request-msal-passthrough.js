// Prepare Request Data - MSAL Passthrough (No Fallbacks)
// This code passes through the actual MSAL authenticated user data from the webhook

// Get the webhook data directly
const webhookData = $input.item.json;

// Extract the MSAL user profile - expecting full profile from MSAL
const userProfile = webhookData.userProfile || webhookData.user;

// Pass through all the data exactly as received from MSAL
const result = {
  // MSAL user profile data
  userProfile: userProfile,
  
  // User context from MSAL session
  userContext: webhookData.userContext,
  
  // Message and session data
  message: webhookData.message,
  sessionId: webhookData.sessionId,
  
  // Voice settings
  voice: webhookData.voice,
  selectedVoice: webhookData.selectedVoice || webhookData.voice,
  enableTTS: webhookData.enableTTS,
  
  // Preview mode
  preview: webhookData.preview,
  
  // Attachments
  attachments: webhookData.attachments,
  
  // Pass through any additional MSAL claims or metadata
  msalClaims: webhookData.msalClaims,
  authenticationMethod: webhookData.authenticationMethod,
  tokenClaims: webhookData.tokenClaims
};

// Return for Code node - must be array with json wrapper
return [{
  json: result
}];