// Universal Fix for n8n AI Agent "No prompt specified" Error
// Place this Code node RIGHT BEFORE your AI Agent node

const inputJson = $input.first().json;

// Find the user's message from various possible field names
const userMessage = 
  inputJson.chatInput ||                    // If already set
  inputJson.userMessage ||                  // From your webhook
  inputJson.MESSAGE_SENT ||                 // From chat frontend
  inputJson.MESSAGE_WITH_ATTACHMENTS ||     // From document processor
  inputJson.message ||                      // Common alternative
  inputJson.prompt ||                       // Another alternative
  inputJson.query ||                        // Query format
  inputJson.text ||                         // Text format
  inputJson.input ||                        // Generic input
  '';                                        // Fallback to empty

// Get session ID from various sources
const sessionId = 
  inputJson.sessionId || 
  inputJson.session_id || 
  inputJson.MESSAGE_METADATA?.sessionId ||
  `session_${Date.now()}`;

// Check if there's extracted content from attachments
const extractedContent = inputJson.extractedContent || '';
const hasAttachments = inputJson.hasProcessedAttachments || 
                       inputJson.attachments?.length > 0 || 
                       false;

// Combine message with any extracted attachment content
let finalMessage = userMessage;

if (extractedContent && extractedContent.length > 0) {
  // If we have extracted content, append it to the message
  finalMessage = `${userMessage}\n\n📎 **Attached Files Content:**\n${extractedContent}\n\n**Please acknowledge and analyze the attached file content above.**`;
} else if (hasAttachments && !extractedContent) {
  // If attachments exist but no content extracted
  finalMessage = `${userMessage}\n\n[Note: File attachments were provided but content could not be extracted]`;
}

// Return with chatInput as the primary field for AI Agent
return {
  ...inputJson,              // Keep all original fields
  chatInput: finalMessage,   // THIS IS WHAT THE AI AGENT NEEDS
  sessionId: sessionId,       // Ensure sessionId exists
  
  // Debug info (can be removed once working)
  _debug: {
    originalUserMessage: userMessage,
    hadExtractedContent: extractedContent.length > 0,
    finalMessageLength: finalMessage.length,
    topLevelFields: Object.keys(inputJson).join(', ')
  }
};