# Simple Memory Node Configuration Fix

## Problem
The Simple Memory node is not finding the sessionId field, even though it's being passed from upstream nodes.

## Solution Options

### Option 1: Add Memory Preprocessor Node (RECOMMENDED)
1. Add a new **Code** node between your current node and the Simple Memory node
2. Name it "Memory Preprocessor"
3. Use the code from `n8n-memory-preprocessor.js`
4. Connect it between your data source and Simple Memory

### Option 2: Configure Simple Memory Node
In the Simple Memory node settings:

1. **Session ID Field**: 
   - Click on the expression editor (fx button)
   - Use one of these expressions:
     ```
     {{ $json.sessionId || $json.json?.sessionId || $json.data?.sessionId || 'session_' + Date.now() }}
     ```
     OR
     ```
     {{ $input.item.json.sessionId }}
     ```

2. **Context Window Size**: Keep at 10 (or your preferred value)

3. **Input Key**: Set to `chatInput` or `message`

4. **Output Key**: Set to `text` or `response`

### Option 3: Use Set Node Before Memory
Add a **Set** node before Simple Memory with these settings:

**Mode**: Keep Everything and Add Fields

**Fields to Set**:
- Name: `sessionId`
- Value: `{{ $json.sessionId || $json.json?.sessionId || 'session_' + Date.now() }}`
- Name: `chatInput`
- Value: `{{ $json.message || $json.chatInput || $json.userMessage }}`

### Option 4: Direct AI Agent Configuration
If the Simple Memory is connected to an AI Agent, in the AI Agent node:

1. Go to **Options** → **Session ID**
2. Set expression: 
   ```
   {{ $json.sessionId || $input.item.json.sessionId || 'session_' + Date.now() }}
   ```

## Testing
After implementing any solution:
1. Send a test message
2. Check the execution to see if sessionId is passed
3. Verify memory is maintained across messages

## Workflow Structure Should Be:
```
Webhook/Trigger
    ↓
Prepare OCR Data (if needed)
    ↓
Prepare Context and Route
    ↓
Memory Preprocessor (NEW - Add this!)
    ↓
Simple Memory
    ↓
AI Agent
```

## Debug Tips
- Use console.log() in Code nodes to track sessionId
- Check the input/output of each node in the execution
- Ensure sessionId is at the root level of the JSON object
- The field name must be exactly "sessionId" (case-sensitive)