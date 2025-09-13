# n8n AI Node Configuration for Document Processing

## After the Document Processor Code Node, configure your AI node:

### 1. In the AI Agent Node (or OpenAI/ChatGPT Node):

**Message Field Configuration:**
- Set the "Message" or "Prompt" field to use: `{{ $json.MESSAGE_WITH_ATTACHMENTS }}`
- This field contains the user's message PLUS the extracted document content

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

### 4. Make sure these fields are passed through:
- `sessionId` - For memory nodes
- `MESSAGE_WITH_ATTACHMENTS` - Contains the combined message + file content
- `extractedContent` - Raw extracted content if needed
- `attachmentProcessing` - Metadata about processed files

## Testing:
1. Send a message with a Word/Excel attachment
2. Check the execution to see if `MESSAGE_WITH_ATTACHMENTS` contains:
   - Your original message
   - The file content between ━━━ markers
   - The instruction to acknowledge the content

## The key field is: `MESSAGE_WITH_ATTACHMENTS`
This is what the AI should read to see both the user's message and the file content.