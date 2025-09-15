// Memory Preprocessor - Place this in a Code node BEFORE Simple Memory node
// This ensures sessionId is in the exact format Simple Memory expects

const inputData = $input.all();
const output = [];

for (const item of inputData) {
    console.log('[Memory Preprocessor] Input keys:', Object.keys(item));
    
    // Extract sessionId from anywhere in the input
    let sessionId = null;
    
    // Direct extraction attempts
    if (item.sessionId) {
        sessionId = item.sessionId;
    } else if (item.json && item.json.sessionId) {
        sessionId = item.json.sessionId;
    } else if (item.data && item.data.sessionId) {
        sessionId = item.data.sessionId;
    } else {
        // Deep search for sessionId
        function findSessionId(obj, depth = 0) {
            if (depth > 5 || !obj || typeof obj !== 'object') return null;
            
            if ('sessionId' in obj && obj.sessionId) {
                return obj.sessionId;
            }
            
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    const found = findSessionId(obj[key], depth + 1);
                    if (found) return found;
                }
            }
            return null;
        }
        
        sessionId = findSessionId(item);
    }
    
    // Generate if still not found
    if (!sessionId) {
        sessionId = `session_${Date.now()}`;
        console.log('[Memory Preprocessor] Generated new sessionId:', sessionId);
    } else {
        console.log('[Memory Preprocessor] Found sessionId:', sessionId);
    }
    
    // Extract message
    let message = item.message || item.chatInput || item.userMessage || '';
    if (!message && item.json) {
        message = item.json.message || item.json.chatInput || item.json.userMessage || '';
    }
    
    // Create output in the EXACT format Simple Memory expects
    // The Simple Memory node expects sessionId at the root level
    const outputItem = {
        sessionId: sessionId,  // CRITICAL: Must be at root level
        message: message,
        chatInput: message,
        userMessage: message,
        ...item  // Preserve all other fields
    };
    
    // Ensure sessionId is definitely there
    if (!outputItem.sessionId) {
        outputItem.sessionId = sessionId;
    }
    
    console.log('[Memory Preprocessor] Output has sessionId:', !!outputItem.sessionId);
    console.log('[Memory Preprocessor] SessionId value:', outputItem.sessionId);
    
    output.push(outputItem);
}

return output;