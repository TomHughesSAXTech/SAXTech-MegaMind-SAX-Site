// SIMPLE MEMORY INPUT FIX
// Place this between Prepare Context and Simple Memory
// Ensures Simple Memory gets only the fields it needs

const input = $json;
const allInputs = $input.all();

console.log('[Memory Input] Input keys:', Object.keys(input));
console.log('[Memory Input] Input data:', JSON.stringify(input).substring(0, 200));

// Extract the message (check all possible locations)
let message = '';
if (input.message && input.message.trim() !== '') {
    message = input.message;
} else if (input.enhancedMessage && input.enhancedMessage.trim() !== '') {
    message = input.enhancedMessage;
} else if (input.chatInput && input.chatInput.trim() !== '') {
    message = input.chatInput;
} else if (input.userMessage && input.userMessage.trim() !== '') {
    message = input.userMessage;
} else {
    // Try to find in all inputs
    for (const item of allInputs) {
        const data = item.json || item;
        if (data.message || data.chatInput || data.userMessage || data.enhancedMessage) {
            message = data.message || data.chatInput || data.userMessage || data.enhancedMessage;
            break;
        }
    }
}

// Extract sessionId (handle 'no-session-id' case)
let sessionId = input.sessionId;
if (!sessionId || sessionId === 'no-session-id') {
    sessionId = `session_${Date.now()}`;
    console.log('[Memory Input] Generated new sessionId:', sessionId);
} else {
    console.log('[Memory Input] Using existing sessionId:', sessionId);
}

console.log('[Memory Input] Message found:', message ? message.substring(0, 100) : 'EMPTY');
console.log('[Memory Input] SessionId:', sessionId);

// If we still don't have a message, create a default one
if (!message || message.trim() === '') {
    message = 'Processing document upload';
    console.log('[Memory Input] No message found, using default');
}

// Return ONLY what Simple Memory needs
// This prevents the "3 keys" error
return [{
  sessionId: sessionId,
  chatInput: message  // Simple Memory expects this field name
}];
