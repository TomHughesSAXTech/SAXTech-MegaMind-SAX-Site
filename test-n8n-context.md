# Test Guide for n8n Build Context Node

## Issues Fixed:
1. ✅ **Message not passing** - Now checks multiple fields (message, body.message, query, text, input)
2. ✅ **Default voice** - Changed from 'alloy' (OpenAI) to 'sarah' (ElevenLabs)
3. ✅ **Empty userProfile** - Added department auto-detection from job title
4. ✅ **Department detection** - "Director of IT Operations" → "Information Technology"

## Testing in n8n:

### 1. Update your Build Context node with the latest code from:
```
/Users/tom/Desktop/WARP.nosync/elevenlabs-chatbot-integration/SAXTech-MegaMind-SAX-Site/n8n-build-context-node.js
```

### 2. Test with this sample input in n8n:
```json
{
  "message": "Hello, can you help me with Azure?",
  "sessionId": "test_session_123",
  "voice": "sarah",
  "userProfile": {
    "displayName": "Tom Hughes",
    "email": "thughes@saxadvisorygroup.com",
    "jobTitle": "Director of IT Operations",
    "officeLocation": "North Carolina"
  }
}
```

### 3. Expected Output Should Include:
- **userMessage**: "Hello, can you help me with Azure?"
- **selectedVoice**: "sarah" (not "alloy")
- **userProfile.department**: "Information Technology" (auto-detected)
- **personalizedContext**: Should show IT-specific instructions
- **voiceId**: "EXAVITQu4vr4xnSDxMaL" (Sarah's ElevenLabs ID)

### 4. Check for Department-Specific Context:
You should see in `personalizedContext`:
```
CONTEXTUAL INSTRUCTIONS FOR IT:
- Provide technical depth and implementation details
- Include security implications and best practices
- Reference ITIL frameworks and enterprise standards
- Mention PowerShell commands and Azure CLI when relevant
- Include links to technical documentation
```

### 5. Verify Voice Settings:
- Should NOT see "alloy" anywhere
- voiceId should map to ElevenLabs IDs
- modelId should be "eleven_multilingual_v2"

## Common Issues & Solutions:

### If userProfile is still empty:
- Check that the website is sending userProfile in the payload
- Verify MSAL authentication is working
- Check browser console for "User profile loaded:" message

### If message is still empty:
- Ensure the message input field has text before sending
- Check the webhook payload in browser Network tab

### If voice is still "alloy":
- Clear browser cache
- Refresh the page
- Check that voiceSelect.value is being set properly

## Debug in Browser Console:
When you send a message, look for:
```javascript
// This should show your profile data:
console.log('Sending payload to n8n:', {
    hasUserProfile: true,  // Should be true
    userProfileName: 'Tom Hughes',
    userProfileEmail: 'thughes@saxadvisorygroup.com',
    userProfileJobTitle: 'Director of IT Operations',
    userProfileDepartment: '',  // Will be detected in n8n
    ...
});
```

## ElevenLabs Voice Mapping:
```javascript
sarah → EXAVITQu4vr4xnSDxMaL
adam → pNInz6obpgDQGcFmaJgB
rachel → 21m00Tcm4TlvDq8ikWAM
emily → MF3mGyEYCl7XYWbV9V6O
domi → AZnzlk1XvdvUeBnXmlld
antoni → ErXwobaYiN019PkySvjV
josh → TxGEqnHWrfWFTfGW9XjX
arnold → VR6AewLTigWG4xSOukaG
nicole → piTKgcLEGmPE4e6mEKli
```

## Success Indicators:
✅ Department shows "Information Technology" for IT roles
✅ Voice defaults to "sarah" not "alloy"
✅ Message text appears in userMessage field
✅ IT-specific instructions appear in context
✅ ElevenLabs voice IDs are used (not OpenAI names)