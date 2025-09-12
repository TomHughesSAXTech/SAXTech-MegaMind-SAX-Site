# How to Configure the Prepare Request Data Node

## Option 1: Change to Code Node (RECOMMENDED)

Replace the Set node with a Code node and use this code:

```javascript
// Get webhook data
const webhookData = $input.item.json;
const rawUser = webhookData.user || webhookData.userProfile || {};

// Build enriched profile
const enrichedUserProfile = {
  name: rawUser.name || 'Unknown User',
  displayName: rawUser.name || 'Unknown User',
  email: rawUser.email || 'user@saxtechnology.com',
  userPrincipalName: rawUser.email || 'user@saxtechnology.com',
  jobTitle: rawUser.jobTitle || 'Employee',
  department: rawUser.department || 'General',
  companyName: 'SAX Advisory Group',
  officeLocation: 'Remote',
  city: '',
  state: '',
  country: 'USA',
  timezone: 'America/New_York',
  groups: [],
  roles: []
};

// Special handling for Tom Hughes
if (rawUser.email === 'thughes@saxadvisorygroup.com') {
  enrichedUserProfile.jobTitle = 'IT Director';
  enrichedUserProfile.department = 'Information Technology';
}

// Build result object - MUST return array with json wrapper
return [{
  json: {
    userProfile: enrichedUserProfile,
    userContext: {},
    message: webhookData.message || '',
    sessionId: webhookData.sessionId || 'session_' + Date.now(),
    voice: webhookData.voice || 'sarah',
    selectedVoice: webhookData.voice || 'sarah',
    enableTTS: webhookData.enableTTS !== false,
    preview: webhookData.preview === true,
    attachments: webhookData.attachments || []
  }
}];
```

## Option 2: Use Set Node with "Fields to Set" Mode

1. Change Mode from "JSON" to "Manual Mapping"
2. Add these fields one by one:

### Field: userProfile
Type: Object
Value: 
```
{
  "name": "{{ $json.user?.name || 'Unknown User' }}",
  "email": "{{ $json.user?.email || 'user@saxtechnology.com' }}",
  "jobTitle": "Employee",
  "department": "General",
  "companyName": "SAX Advisory Group"
}
```

### Field: message
Type: String
Value: `{{ $json.message || '' }}`

### Field: sessionId
Type: String
Value: `{{ $json.sessionId || 'session_' + Date.now() }}`

### Field: enableTTS
Type: Boolean
Value: `{{ $json.enableTTS !== false }}`

### Field: selectedVoice
Type: String
Value: `{{ $json.voice || 'sarah' }}`

## Option 3: Use Expression in JSON Mode

If you must use JSON mode, put this in the JSON field with Expression toggle ON:

```
{{ 
  {
    "userProfile": {
      "name": $json.user?.name || "Unknown User",
      "email": $json.user?.email || "user@saxtechnology.com",
      "jobTitle": "Employee",
      "department": "General",
      "companyName": "SAX Advisory Group"
    },
    "message": $json.message || "",
    "sessionId": $json.sessionId || "session_" + Date.now(),
    "enableTTS": $json.enableTTS !== false,
    "selectedVoice": $json.voice || "sarah",
    "attachments": $json.attachments || []
  }
}}
```

**IMPORTANT**: Make sure the Expression toggle (fx button) is ENABLED when using expressions!