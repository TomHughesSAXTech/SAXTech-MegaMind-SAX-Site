# Screenshot Paste Feature - SAX MegaMind

## Overview
The SAX MegaMind chat now supports pasting screenshots directly into the chat interface. This feature allows users to share visual information that the AI can analyze and respond to contextually.

## How It Works

### Frontend (index.html)
1. **Paste Event Listener**: Captures clipboard paste events on the message input field
2. **Image Detection**: Checks if the pasted content is an image
3. **Base64 Conversion**: Converts the image blob to base64 data URL
4. **Visual Preview**: Shows a thumbnail preview of the pasted image
5. **Data Attachment**: Adds the image data to the message payload

### Features Added:
- Automatic detection of pasted images (Ctrl+V / Cmd+V)
- Visual preview of pasted screenshots before sending
- Images are displayed in the chat after sending
- Full base64 image data sent to backend for processing
- Automatic cleanup of attachments after sending

### Backend (n8n Workflow)
The n8n workflow can process these images using:

1. **Azure Computer Vision OCR** - Extract text from screenshots
2. **Image Analysis** - Understand image content
3. **Context Enhancement** - Add extracted information to AI prompt

## User Experience

### To Use:
1. Take a screenshot (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
2. Click in the message input field
3. Paste (Ctrl+V or Cmd+V)
4. See preview appear above input field
5. Type your message (optional)
6. Click Send

### What Happens:
- Screenshot preview appears with confirmation message
- Image is shown in chat when sent
- AI receives both your message and the screenshot content
- AI can reference and analyze the screenshot in its response

## Technical Implementation

### Data Structure:
```javascript
attachedFiles.push({
    name: `screenshot_${Date.now()}.png`,
    type: 'image/png',
    size: blob.size,
    data: base64Data,  // Full base64 image data
    isScreenshot: true  // Flag for backend processing
});
```

### Payload to n8n:
```javascript
attachments: attachedFiles.map(f => ({
    name: f.name,
    type: f.type,
    size: f.size,
    data: f.data || null,  // Includes base64 data
    isScreenshot: f.isScreenshot || false
}))
```

## n8n Workflow Configuration

### Required Azure Services:
1. **Azure Computer Vision** - For OCR and image analysis
   - Create resource in Azure Portal
   - Get API key and endpoint
   - Configure in n8n credentials

### Workflow Steps:
1. **Webhook Receive** - Accepts incoming messages with attachments
2. **Check for Images** - Routes messages with screenshots for processing
3. **Process Images** - Extracts base64 data and prepares for OCR
4. **Azure OCR** - Sends image to Computer Vision API
5. **Extract Text** - Processes OCR results
6. **Enhance Context** - Adds extracted text to AI prompt
7. **AI Response** - Generates response with full context

### n8n Code Node for Processing:
```javascript
// Check for screenshots
const attachments = inputData.attachments || [];
for (const attachment of attachments) {
    if (attachment.isScreenshot && attachment.data) {
        // Process base64 image data
        const base64Data = attachment.data.replace(/^data:image\/[a-z]+;base64,/, '');
        // Send to OCR service
    }
}
```

## Benefits

1. **Visual Context**: Share UI issues, error messages, or visual content
2. **No File Upload**: Direct paste is faster than file selection
3. **Immediate Preview**: See what you're sharing before sending
4. **OCR Integration**: Text in images becomes searchable/analyzable
5. **Enhanced AI Understanding**: AI can "see" what you're referring to

## Use Cases

- **Technical Support**: Paste error messages or console screenshots
- **UI/UX Feedback**: Share interface issues or suggestions
- **Data Analysis**: Share charts, graphs, or spreadsheet snippets
- **Documentation**: Share relevant documentation screenshots
- **Code Review**: Paste code snippets as images for discussion

## Security Considerations

- Images are converted to base64 and included in the request payload
- Large images may increase request size significantly
- Consider implementing size limits if needed
- Base64 data is cleared from memory after sending
- No images are permanently stored on the frontend

## Future Enhancements

1. **Multiple Image Support**: Paste multiple screenshots
2. **Image Compression**: Reduce size before sending
3. **Drawing Tools**: Annotate screenshots before sending
4. **File Type Support**: Support more image formats
5. **Drag & Drop**: Alternative to paste
6. **Image Storage**: Optional Azure Blob storage for large images

## Troubleshooting

### If paste doesn't work:
1. Ensure you're clicking in the message input field first
2. Check browser console for errors
3. Verify clipboard contains an image (not a file path)
4. Try refreshing the page

### If images don't appear:
1. Check browser console for base64 conversion errors
2. Verify attachments preview div is created
3. Check if attachedFiles array is populated

### If backend doesn't process:
1. Verify n8n workflow is active
2. Check Azure Computer Vision credentials
3. Review n8n execution logs
4. Ensure webhook URL is correct

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (macOS 10.15+)
- Mobile: Limited (paste API varies)

## Related Files

- `/index.html` - Main implementation
- `/add-paste-support.js` - Original paste handler code
- `/n8n-process-images.js` - Backend processing example
- `/n8n-image-processing-workflow.json` - Complete n8n workflow