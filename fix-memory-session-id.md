# Fixing "No session ID found" Error in Simple Memory Node

## The Problem:
The Simple Memory node expects the session ID in a specific field, but our context node is outputting it as `sessionId`.

## Solution Options:

### Option 1: Add a Set Node Before the Agent (Recommended)

Add a **Set** node between your Context node and the Agent node to map the sessionId correctly:

**Set Node Configuration:**
- Mode: **Set Specific Fields**
- Add Field:
  - Name: `sessionId`
  - Value: `{{$json["sessionId"]}}`
  - Keep all other fields: **ON**

This ensures the sessionId is available at the root level where Simple Memory expects it.

### Option 2: Configure Simple Memory Node Directly

In your **Simple Memory** node configuration:

1. Click on the Simple Memory node
2. Find the **Session ID** field
3. Instead of leaving it empty or default, explicitly set it to:
   ```
   {{$json["sessionId"]}}
   ```

### Option 3: Update Your Context Node

Modify your context node to ensure sessionId is passed correctly:

```javascript
// At the end of your context node, make sure to include:
return [{
  json: {
    ...contextData,
    sessionId: sessionId,  // Ensure this is at root level
    // Also include it for the memory node
    memory: {
      sessionId: sessionId
    }
  }
}];
```

### Option 4: Use Expression in Agent Node

In your **Agent** node, configure the memory settings:

1. Open the Agent node
2. Expand **Memory** settings
3. For Session ID, use:
   ```
   {{$json["sessionId"]}}
   ```

## Complete Fix - Update Context Node:

Replace the return statement in your context node with:

```javascript
// Return array with json wrapper for Code node
return [{
  json: {
    // All the context data
    userMessage: message,
    sessionId: sessionId,  // Critical for memory
    personalizedContext: completeContext,
    userProfile: userProfile,
    userContext: userContext,
    userPermissions: userPermissions,
    selectedVoice: voice,
    enableTTS: enableTTS,
    profile: profile,
    requestMetadata: {
      timestamp: new Date().toISOString(),
      department: userProfile.department || 'Unknown',
      jobTitle: userProfile.jobTitle || 'Unknown',
      tenantId: userProfile.tenantId || null,
      objectId: userProfile.objectId || null,
      hasManager: !!userProfile.manager,
      hasGroups: groups.length > 0,
      hasRoles: roles.length > 0,
      attachmentCount: attachments?.length || 0,
      authMethod: 'MSAL',
      webhookHeaders: $input.item.json.headers ? {
        origin: $input.item.json.headers.origin,
        realIp: $input.item.json.headers['x-real-ip']
      } : {}
    },
    // Duplicate for memory node compatibility
    chat_session_id: sessionId,
    userId: userProfile.email || userProfile.userPrincipalName
  }
}];
```

## Testing the Fix:

1. Add a Code node after your Context node to verify sessionId:
   ```javascript
   console.log("Session ID:", $json.sessionId);
   console.log("Full data:", JSON.stringify($json, null, 2));
   return $input.items;
   ```

2. Check that sessionId appears in the output

3. Ensure the Agent node can access it with `{{$json["sessionId"]}}`

## Memory Node Types in n8n:

If Simple Memory continues to fail, try these alternatives:

1. **Window Buffer Memory**: Doesn't require session ID, just keeps last N messages
2. **In-Memory Vector Store**: More complex but doesn't require explicit session ID
3. **Custom Memory**: Build your own with a Code node

## Quick Debug:

In the Agent node, you can also try setting a static session ID first to test:
- Session ID: `test-session-123`

If it works with a static ID, then the issue is definitely how the sessionId is being passed from the Context node.