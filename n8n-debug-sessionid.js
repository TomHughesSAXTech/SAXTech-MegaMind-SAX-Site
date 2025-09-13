// Debug code to find sessionId in n8n workflow
// Use this in a Code node to see your data structure

const inputData = $input.first().json;

// Function to recursively find all occurrences of sessionId
function findSessionId(obj, path = '') {
  const results = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if this key contains 'session' (case-insensitive)
      if (key.toLowerCase().includes('session')) {
        results.push({
          path: currentPath,
          value: obj[key]
        });
      }
      
      // Recursively search in nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        results.push(...findSessionId(obj[key], currentPath));
      }
    }
  }
  
  return results;
}

// Find all session-related fields
const sessionFields = findSessionId(inputData);

// Prepare debug output
const debugInfo = {
  found_session_fields: sessionFields,
  suggested_sessionId: sessionFields[0]?.value || `session_${Date.now()}`,
  full_input_structure: Object.keys(inputData),
  top_level_keys: Object.keys(inputData).join(', ')
};

console.log('=== SESSION ID DEBUG INFO ===');
console.log('Found session fields:', sessionFields);
console.log('Top level keys:', Object.keys(inputData));

// Return the data with sessionId properly set
return {
  ...inputData,
  sessionId: sessionFields[0]?.value || inputData.sessionId || `session_${Date.now()}`,
  _debug_info: debugInfo
};