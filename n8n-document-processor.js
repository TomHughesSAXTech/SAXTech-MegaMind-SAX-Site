// Advanced Document Processor with Azure Document Intelligence
const inputData = $input.all()[0].json;
const attachments = inputData.body?.attachments || inputData.attachments || [];

// Azure Configuration
const VISION_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const VISION_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';

// Use Document Intelligence API for PDFs and complex documents
const DOCUMENT_API_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31';

let extractedContent = '';
let processedAttachments = [];

console.log(`Processing ${attachments.length} attachment(s)...`);

for (const attachment of attachments) {
    if (!attachment.data) continue;
    
    const fileName = attachment.name || 'unnamed';
    const fileType = attachment.type || '';
    
    try {
        // Handle PDFs and Office documents with Document Intelligence
        if (fileType === 'application/pdf' || 
            fileName.toLowerCase().endsWith('.pdf') ||
            fileType.includes('word') || 
            fileName.match(/\.(doc|docx)$/i)) {
            
            console.log(`Processing document with Azure Document Intelligence: ${fileName}`);
            
            // Convert base64 to buffer
            const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, '');
            const documentBuffer = Buffer.from(base64Data, 'base64');
            
            try {
                // Submit document for analysis
                const analyzeResponse = await this.helpers.httpRequest({
                    method: 'POST',
                    url: DOCUMENT_API_ENDPOINT,
                    headers: {
                        'Ocp-Apim-Subscription-Key': VISION_KEY,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: documentBuffer,
                    returnFullResponse: true,
                    json: false
                });
                
                // Get the operation location from headers
                const operationLocation = analyzeResponse.headers['operation-location'];
                
                if (operationLocation) {
                    // Poll for results (Document Intelligence is async)
                    let result = null;
                    let attempts = 0;
                    const maxAttempts = 10;
                    
                    while (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                        
                        const statusResponse = await this.helpers.httpRequest({
                            method: 'GET',
                            url: operationLocation,
                            headers: {
                                'Ocp-Apim-Subscription-Key': VISION_KEY
                            }
                        });
                        
                        if (statusResponse.status === 'succeeded') {
                            result = statusResponse.analyzeResult;
                            break;
                        } else if (statusResponse.status === 'failed') {
                            throw new Error('Document analysis failed');
                        }
                        
                        attempts++;
                    }
                    
                    if (result && result.content) {
                        extractedContent += `\n\n--- Document Content from ${fileName} ---\n${result.content}\n`;
                        
                        processedAttachments.push({
                            name: fileName,
                            type: 'document',
                            text: result.content,
                            pageCount: result.pages ? result.pages.length : 0
                        });
                    }
                }
            } catch (docError) {
                console.error(`Document Intelligence failed for ${fileName}:`, docError.message);
                
                // Fallback: Just acknowledge the document
                extractedContent += `\n\n--- Document Attached: ${fileName} ---\n`;
                extractedContent += `[Document processing error - ${attachment.size} bytes]\n`;
            }
        }
        // Handle images with OCR
        else if (attachment.isScreenshot || fileType.startsWith('image/')) {
            console.log(`Processing image with OCR: ${fileName}`);
            
            const base64Data = attachment.data.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            const ocrResponse = await this.helpers.httpRequest({
                method: 'POST',
                url: `${VISION_ENDPOINT}vision/v3.2/ocr`,
                headers: {
                    'Ocp-Apim-Subscription-Key': VISION_KEY,
                    'Content-Type': 'application/octet-stream'
                },
                body: imageBuffer,
                qs: {
                    language: 'en',
                    detectOrientation: 'true'
                },
                json: false,
                returnFullResponse: false
            });
            
            let imageText = '';
            if (ocrResponse.regions && ocrResponse.regions.length > 0) {
                ocrResponse.regions.forEach(region => {
                    if (region.lines) {
                        region.lines.forEach(line => {
                            let lineText = '';
                            if (line.words) {
                                line.words.forEach(word => {
                                    lineText += word.text + ' ';
                                });
                            }
                            imageText += lineText.trim() + '\n';
                        });
                    }
                });
            }
            
            if (imageText) {
                extractedContent += `\n\n--- Image Content from ${fileName} ---\n${imageText.trim()}\n`;
                processedAttachments.push({
                    name: fileName,
                    type: 'image',
                    text: imageText.trim()
                });
            }
        }
        // Handle text files
        else if (fileType.startsWith('text/') || fileName.match(/\.(txt|md|csv|json|xml|log)$/i)) {
            const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, '');
            const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
            
            extractedContent += `\n\n--- Text Content from ${fileName} ---\n${textContent}\n`;
            
            processedAttachments.push({
                name: fileName,
                type: 'text',
                text: textContent
            });
        }
        // Other file types
        else {
            extractedContent += `\n\n--- Attachment: ${fileName} ---\n`;
            extractedContent += `[File Type: ${fileType || 'Unknown'} - ${attachment.size} bytes]\n`;
            
            processedAttachments.push({
                name: fileName,
                type: fileType || 'unknown',
                size: attachment.size
            });
        }
        
    } catch (error) {
        console.error(`Error processing ${fileName}:`, error.message);
        extractedContent += `\n\n--- Attachment: ${fileName} (Processing Error) ---\n`;
    }
}

// Build the enhanced message
const originalMessage = inputData.body?.message || inputData.message || '';
let enhancedMessage = originalMessage.replace(/\[Context: User has .*?\]/g, '').trim();

if (extractedContent) {
    enhancedMessage = `${enhancedMessage}

[Attached Content Analysis]:${extractedContent}

Important: The user has attached ${attachments.length} file(s). Please acknowledge and reference the attached content in your response.`;
}

console.log(`Processed ${processedAttachments.length} of ${attachments.length} attachments`);

// Return the enhanced data
return [{
    json: {
        ...inputData.body || inputData,
        message: enhancedMessage,
        originalMessage: originalMessage,
        attachmentCount: attachments.length,
        processedAttachments: processedAttachments,
        extractedContent: extractedContent,
        hasAttachments: attachments.length > 0,
        attachments: attachments
    }
}];