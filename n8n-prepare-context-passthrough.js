// Prepare Context and Route - Ensures chatInput exists for AI Agent

const data = $input.first().json;

// Make absolutely sure chatInput exists
if (!data.chatInput) {
  // Try to find the message in various places
  data.chatInput = data.message || 
                   data.MESSAGE_SENT || 
                   data.body?.message || 
                   data.userMessage || 
                   'Hello';
}

return data;
