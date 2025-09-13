# n8n Integration - Add Image OCR to Existing MegaMind Workflow

## Overview
This adds screenshot/image OCR processing to your EXISTING MegaMind workflow without creating new webhooks or AI agents.

## Method 1: Single Code Node (Recommended)

### Step 1: Add Code Node
1. In your existing MegaMind workflow
2. Add a **Code** node AFTER the Webhook node
3. Connect: Webhook → Code Node → Your existing processing
4. Paste the code from `n8n-process-images-in-existing-workflow.js`

### What It Does:
- Checks if attachments contain screenshots
- Sends images to Azure Computer Vision OCR
- Extracts text from images
- Adds extracted text to the message
- Passes enhanced data to your existing AI

## Method 2: Using Separate Nodes

### Step 1: Add IF Node (Check for Images)
```javascript
// IF Node Expression:
{{ $json.attachments.some(a => a.isScreenshot && a.data) }}
```

### Step 2: Add Code Node (Extract Base64)
```javascript
const attachments = $json.attachments || [];
const screenshots = attachments.filter(a => a.isScreenshot && a.data);

return screenshots.map(screenshot => ({
  json: {
    ...$json,
    currentImage: {
      name: screenshot.name,
      base64: screenshot.data.replace(/^data:image\/[a-z]+;base64,/, ''),
      type: screenshot.type
    }
  }
}));
```

### Step 3: Add HTTP Request Node (Azure OCR)
- **Method**: POST
- **URL**: `https://client-fcs.cognitiveservices.azure.com/vision/v3.2/ocr?language=en&detectOrientation=true`
- **Authentication**: Header Auth
- **Header Name**: `Ocp-Apim-Subscription-Key`
- **Header Value**: `7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6`
- **Content Type**: `application/octet-stream`
- **Body Type**: Binary Data
- **Binary Data**: `={{ Buffer.from($json.currentImage.base64, 'base64') }}`

### Step 4: Add Code Node (Extract OCR Text)
```javascript
const ocrResult = $json;
let extractedText = '';

if (ocrResult.regions && ocrResult.regions.length > 0) {
    ocrResult.regions.forEach(region => {
        if (region.lines) {
            region.lines.forEach(line => {
                let lineText = '';
                if (line.words) {
                    line.words.forEach(word => {
                        lineText += word.text + ' ';
                    });
                }
                extractedText += lineText.trim() + '\n';
            });
        }
    });
}

return [{
    json: {
        ...items[0].json,
        extractedText: extractedText.trim()
    }
}];
```

### Step 5: Add Code Node (Merge OCR Results)
```javascript
// Combine all OCR results
const allItems = $input.all();
let combinedText = '';

allItems.forEach(item => {
    if (item.json.extractedText) {
        combinedText += item.json.extractedText + '\n\n';
    }
});

// Get original message from first item
const originalData = allItems[0].json;

// Enhanced message with OCR content
const enhancedMessage = combinedText ? 
    `${originalData.message}\n\n[Screenshot Content:]\\n${combinedText}` : 
    originalData.message;

return [{
    json: {
        ...originalData,
        message: enhancedMessage,
        extractedImageText: combinedText,
        ocrProcessed: true
    }
}];
```

### Step 6: Add Merge Node
- Connect both IF branches (true/false) to a Merge node
- Mode: Choose Branch
- Output: Input 2 (to pass through non-image messages unchanged)

## Azure Computer Vision Details

### Endpoint Information
- **Service**: Client-FCS (AI Services)
- **Location**: East US 2
- **Endpoint**: `https://client-fcs.cognitiveservices.azure.com/`
- **API Key**: `7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6`

### OCR API Endpoints Available:
1. **Basic OCR** (used): `/vision/v3.2/ocr`
2. **Read API** (better for documents): `/vision/v3.2/read/analyze`
3. **Form Recognizer**: Available via same endpoint

## Integration Points in Your Current Workflow

### Current Flow:
```
Webhook → Prepare Context → AI Agent → Format Response
```

### New Flow:
```
Webhook → Process Images (OCR) → Prepare Context → AI Agent → Format Response
```

## Testing the Integration

### Test Payload:
```javascript
{
  "message": "What does this error mean?",
  "attachments": [
    {
      "name": "screenshot_1234567.png",
      "type": "image/png",
      "size": 50000,
      "data": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "isScreenshot": true
    }
  ]
}
```

### Expected Output:
```javascript
{
  "message": "What does this error mean?\n\n[Screenshot Content:]\nError: Cannot find module 'express'...",
  "extractedImageText": "Error: Cannot find module 'express'...",
  "ocrProcessed": true
}
```

## Important Notes

1. **Image Size**: Azure OCR has a 50MB limit per image
2. **Rate Limits**: 20 calls per second for Computer Vision
3. **Supported Formats**: JPEG, PNG, BMP, PDF, TIFF
4. **Languages**: Set to English ('en'), but supports 50+ languages
5. **Cost**: S0 tier - ~$1 per 1000 transactions

## Alternative: Using Read API for Better Results

For better OCR (especially for documents), use the Read API:

```javascript
// Step 1: Submit for processing
const readResponse = await this.helpers.httpRequest({
    method: 'POST',
    url: `${VISION_ENDPOINT}vision/v3.2/read/analyze`,
    headers: {
        'Ocp-Apim-Subscription-Key': VISION_KEY,
        'Content-Type': 'application/octet-stream'
    },
    body: imageBuffer,
    resolveWithFullResponse: true
});

// Step 2: Get operation location
const operationLocation = readResponse.headers['operation-location'];

// Step 3: Poll for results (add wait node or loop)
const resultResponse = await this.helpers.httpRequest({
    method: 'GET',
    url: operationLocation,
    headers: {
        'Ocp-Apim-Subscription-Key': VISION_KEY
    }
});

// Extract text from result
if (resultResponse.status === 'succeeded') {
    const pages = resultResponse.analyzeResult.readResults;
    // Process pages[].lines[].text
}
```

## Troubleshooting

### If OCR fails:
1. Check image size (< 50MB)
2. Verify base64 is properly formatted
3. Check Azure subscription status
4. Verify API key is active

### If no text extracted:
1. Image might not contain readable text
2. Image quality might be too low
3. Text might be in unsupported language

### Debug Mode:
Add console output in Code node:
```javascript
console.log('Processing image:', attachment.name);
console.log('Base64 length:', base64Data.length);
console.log('OCR Response:', JSON.stringify(ocrResponse, null, 2));
```

## Security Note
The API key is included directly for your convenience. In production:
1. Use n8n Credentials instead
2. Or store in environment variables
3. Rotate keys periodically via Azure Portal