# OCR Workflow Setup for n8n

Since your n8n version doesn't have `$helpers` or `$http` available in Code nodes, you'll need to set up the OCR using HTTP Request nodes instead.

## Workflow Structure

1. **Webhook Node** (receives the data)
   ↓
2. **Code Node** - "Prepare OCR Data"
   - Use the code from: `ocr-simple-processor.js`
   - This prepares the attachments for processing
   ↓
3. **Loop Over Items Node** - "Process Each Attachment"
   - Split out each attachment for individual processing
   ↓
4. **HTTP Request Node** - "Send to Azure OCR"
   - Method: POST
   - URL: `https://sax-megamind-document-intel.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`
   - Authentication: None (we'll use headers)
   - Headers:
     - `Ocp-Apim-Subscription-Key`: `0f91c7f056284e1c84695c0af94797c1`
     - `Content-Type`: `application/octet-stream`
   - Body Content Type: Binary
   - Binary Property: `binaryData` (from the Code node output)
   - Response Format: Full Response
   ↓
5. **Code Node** - "Get Operation URL"
   - Extract the operation-location header from response
   ```javascript
   const headers = $input.first().json.headers;
   return {
     operationUrl: headers['operation-location']
   };
   ```
   ↓
6. **Wait Node** - "Wait 2 seconds"
   - Wait for: 2 seconds
   ↓
7. **HTTP Request Node** - "Check OCR Status"
   - Method: GET
   - URL: `{{ $json.operationUrl }}`
   - Headers:
     - `Ocp-Apim-Subscription-Key`: `0f91c7f056284e1c84695c0af94797c1`
   - Response Format: JSON
   ↓
8. **IF Node** - "Check if Complete"
   - Condition: `{{ $json.status }}` equals `succeeded`
   - If False → Loop back to Wait Node
   - If True → Continue
   ↓
9. **Code Node** - "Extract Text"
   ```javascript
   const result = $input.first().json;
   let extractedText = [];
   
   if (result.analyzeResult && result.analyzeResult.pages) {
     for (const page of result.analyzeResult.pages) {
       if (page.lines) {
         for (const line of page.lines) {
           if (line.content) {
             extractedText.push(line.content);
           }
         }
       }
     }
   }
   
   return {
     extractedText: extractedText.join('\n')
   };
   ```
   ↓
10. **Merge Node** - "Combine Results"
    - Merge all processed attachments back together

## Alternative: Use a Custom Function Node

If your n8n version supports Function nodes (which have more capabilities than Code nodes), you can try using a Function node instead with this code:

```javascript
const axios = require('axios');

// Azure configuration
const AZURE_ENDPOINT = 'https://sax-megamind-document-intel.cognitiveservices.azure.com/';
const AZURE_API_KEY = '0f91c7f056284e1c84695c0af94797c1';
const API_VERSION = '2024-02-29-preview';

// Get input data
const items = $input.all();
const data = items[0].json.body || items[0].json;

// Process attachments...
// (rest of the OCR logic using axios for HTTP requests)
```

## Simplest Solution: Direct Pass-Through

If OCR isn't working due to n8n limitations, you can temporarily bypass it:

1. Update the Code node to just pass through the message without OCR:

```javascript
const webhookData = $input.first().json;
const data = webhookData.body || webhookData;

// Just pass through without OCR for now
return {
    sessionId: data.sessionId || '',
    userMessage: data.message || data.userMessage || '',
    chatInput: data.message || data.userMessage || '',
    body: data
};
```

This will at least keep the workflow running while we figure out the OCR issue.