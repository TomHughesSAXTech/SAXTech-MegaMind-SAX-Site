# n8n AI Node Configuration for Document Processing

## After the Document Processor Code Node, configure your AI node:

### 1. In the AI Agent Node:

**IMPORTANT: The document processor now automatically sets the correct field!**
- The code outputs `chatInput` which the AI Agent expects
- You don't need to change any field mappings
- Just leave the Prompt setting as "Take from previous node automatically"

### 2. Alternative: If using a Chat Model Node:

**User Message Configuration:**
```
{{ $json.MESSAGE_WITH_ATTACHMENTS }}
```

### 3. If you need to pass the message separately:

**System Prompt:**
```
You are a helpful AI assistant. When documents are attached, their content will be provided in the message. Always acknowledge and analyze any attached file content.
```

**User Message:**
```
{{ $json.MESSAGE_WITH_ATTACHMENTS }}
```

### 4. Fields that are automatically handled:
- `chatInput` - The AI Agent reads this (contains message + file content)
- `sessionId` - For memory nodes
- `MESSAGE_WITH_ATTACHMENTS` - Backup field with combined content
- `extractedContent` - Raw extracted content if needed
- `attachmentProcessing` - Metadata about processed files

## Testing:
1. Send a message with a Word/Excel attachment
2. Check the execution to see if `MESSAGE_WITH_ATTACHMENTS` contains:
   - Your original message
   - The file content between ━━━ markers
   - The instruction to acknowledge the content

## The key field is: `chatInput`
This is automatically set by the document processor and contains both the user's message and file content.

## NO CONFIGURATION NEEDED!
The document processor outputs the correct field name that the AI Agent expects.
