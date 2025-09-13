// Universal Document Processor for n8n
// Handles: PDF, Word, Excel, PowerPoint, Images, Text files
const inputData = $input.all()[0].json;
const attachments = inputData.body?.attachments || inputData.attachments || [];

// Azure Configuration
const COGNITIVE_ENDPOINT = 'https://client-fcs.cognitiveservices.azure.com/';
const COGNITIVE_KEY = '7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6';

// Document Intelligence API endpoints
const DOCUMENT_ANALYZE_URL = `${COGNITIVE_ENDPOINT}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31`;
const OCR_URL = `${COGNITIVE_ENDPOINT}vision/v3.2/ocr`;

let extractedContent = '';
let processedAttachments = [];
let attachmentSummary = [];

console.log(`=== Processing ${attachments.length} attachment(s) ===`);

// Helper function to wait for async document processing
async function waitForDocumentAnalysis(operationLocation, apiKey, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
        
        try {
            const statusResponse = await this.helpers.httpRequest({
                method: 'GET',
                url: operationLocation,
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });
            
            if (statusResponse.status === 'succeeded') {
                return statusResponse.analyzeResult;
            } else if (statusResponse.status === 'failed') {
                throw new Error('Document analysis failed: ' + (statusResponse.error?.message || 'Unknown error'));
            }
            
            console.log(`Document processing status: ${statusResponse.status} (attempt ${i + 1}/${maxAttempts})`);
        } catch (error) {
            console.error(`Error checking status (attempt ${i + 1}):`, error.message);
        }
    }
    throw new Error('Document analysis timed out');
}

// Process each attachment
for (const attachment of attachments) {
    if (!attachment.data) {
        console.log(`Skipping attachment without data: ${attachment.name}`);
        continue;
    }
    
    const fileName = attachment.name || 'unnamed_file';
    const fileType = attachment.type || '';
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    console.log(`\nProcessing: ${fileName} (type: ${fileType}, extension: ${fileExtension})`);
    
    try {
        // Determine file category
        let fileCategory = 'unknown';
        let shouldUseDocumentIntelligence = false;
        
        // Categorize file types
        if (fileType === 'application/pdf' || fileExtension === 'pdf') {
            fileCategory = 'PDF';
            shouldUseDocumentIntelligence = true;
        } else if (fileType.includes('word') || ['doc', 'docx'].includes(fileExtension)) {
            fileCategory = 'Word Document';
            shouldUseDocumentIntelligence = true;
        } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(fileExtension)) {
            fileCategory = 'Excel/Spreadsheet';
            shouldUseDocumentIntelligence = true;
        } else if (fileType.includes('powerpoint') || fileType.includes('presentation') || ['ppt', 'pptx'].includes(fileExtension)) {
            fileCategory = 'PowerPoint';
            shouldUseDocumentIntelligence = true;
        } else if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(fileExtension) || attachment.isScreenshot) {
            fileCategory = 'Image';
            shouldUseDocumentIntelligence = false; // Use OCR for images
        } else if (fileType.startsWith('text/') || ['txt', 'md', 'log', 'json', 'xml', 'html', 'css', 'js', 'py', 'java', 'cpp', 'c', 'h'].includes(fileExtension)) {
            fileCategory = 'Text File';
            shouldUseDocumentIntelligence = false; // Direct text extraction
        }
        
        console.log(`File category: ${fileCategory}`);
        
        // Extract base64 data
        const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, '');
        const documentBuffer = Buffer.from(base64Data, 'base64');
        
        // Process based on file category
        if (shouldUseDocumentIntelligence) {
            // Use Document Intelligence for complex documents
            console.log('Using Azure Document Intelligence for processing...');
            
            try {
                // Submit document for analysis
                const analyzeResponse = await this.helpers.httpRequest({
                    method: 'POST',
                    url: DOCUMENT_ANALYZE_URL,
                    headers: {
                        'Ocp-Apim-Subscription-Key': COGNITIVE_KEY,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: documentBuffer,
                    returnFullResponse: true,
                    json: false,
                    timeout: 30000
                });
                
                // Get operation location from headers
                const operationLocation = analyzeResponse.headers['operation-location'] || 
                                        analyzeResponse.headers['Operation-Location'];
                
                if (operationLocation) {
                    console.log('Document submitted for analysis, waiting for results...');
                    
                    // Wait for and get results
                    const result = await waitForDocumentAnalysis.call(this, operationLocation, COGNITIVE_KEY);
                    
                    if (result && result.content) {
                        // Extract structured content
                        let documentText = result.content;
                        
                        // Add table information if present
                        if (result.tables && result.tables.length > 0) {
                            documentText += '\n\n[Tables found in document:]\n';
                            result.tables.forEach((table, index) => {
                                documentText += `\nTable ${index + 1} (${table.rowCount} rows x ${table.columnCount} columns)\n`;
                            });
                        }
                        
                        extractedContent += `\n\n━━━ ${fileCategory}: ${fileName} ━━━\n`;
                        extractedContent += documentText;
                        extractedContent += `\n━━━ End of ${fileName} ━━━\n`;
                        
                        processedAttachments.push({
                            name: fileName,
                            type: fileCategory,
                            text: documentText.substring(0, 1000) + (documentText.length > 1000 ? '...' : ''),
                            fullLength: documentText.length,
                            pageCount: result.pages ? result.pages.length : 0,
                            tableCount: result.tables ? result.tables.length : 0
                        });
                        
                        attachmentSummary.push(`✓ ${fileName} (${fileCategory}, ${result.pages?.length || 0} pages)`);
                        console.log(`Successfully extracted ${documentText.length} characters from ${fileName}`);
                    } else {
                        throw new Error('No content extracted from document');
                    }
                } else {
                    throw new Error('No operation location received from API');
                }
            } catch (docError) {
                console.error(`Document Intelligence error for ${fileName}:`, docError.message);
                
                // Fallback message
                extractedContent += `\n\n━━━ ${fileCategory}: ${fileName} ━━━\n`;
                extractedContent += `[Unable to extract content - ${docError.message}]\n`;
                extractedContent += `File size: ${attachment.size} bytes\n`;
                
                attachmentSummary.push(`⚠️ ${fileName} (${fileCategory}, processing failed)`);
            }
        } else if (fileCategory === 'Image') {
            // Use OCR for images
            console.log('Using OCR for image processing...');
            
            try {
                const ocrResponse = await this.helpers.httpRequest({
                    method: 'POST',
                    url: OCR_URL,
                    headers: {
                        'Ocp-Apim-Subscription-Key': COGNITIVE_KEY,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: documentBuffer,
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
                    extractedContent += `\n\n━━━ Image: ${fileName} ━━━\n`;
                    extractedContent += imageText;
                    extractedContent += `\n━━━ End of ${fileName} ━━━\n`;
                    
                    processedAttachments.push({
                        name: fileName,
                        type: 'Image',
                        text: imageText.substring(0, 500) + (imageText.length > 500 ? '...' : ''),
                        fullLength: imageText.length
                    });
                    
                    attachmentSummary.push(`✓ ${fileName} (Image with text)`);
                } else {
                    extractedContent += `\n\n━━━ Image: ${fileName} ━━━\n`;
                    extractedContent += `[Image contains no readable text]\n`;
                    
                    attachmentSummary.push(`✓ ${fileName} (Image, no text found)`);
                }
            } catch (ocrError) {
                console.error(`OCR error for ${fileName}:`, ocrError.message);
                extractedContent += `\n\n━━━ Image: ${fileName} ━━━\n`;
                extractedContent += `[OCR processing failed]\n`;
                
                attachmentSummary.push(`⚠️ ${fileName} (Image, OCR failed)`);
            }
        } else if (fileCategory === 'Text File') {
            // Direct text extraction
            console.log('Extracting text directly...');
            
            try {
                const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
                
                extractedContent += `\n\n━━━ Text File: ${fileName} ━━━\n`;
                extractedContent += textContent;
                extractedContent += `\n━━━ End of ${fileName} ━━━\n`;
                
                processedAttachments.push({
                    name: fileName,
                    type: 'Text',
                    text: textContent.substring(0, 1000) + (textContent.length > 1000 ? '...' : ''),
                    fullLength: textContent.length
                });
                
                attachmentSummary.push(`✓ ${fileName} (Text file, ${textContent.length} chars)`);
            } catch (textError) {
                console.error(`Text extraction error for ${fileName}:`, textError.message);
                extractedContent += `\n\n━━━ Text File: ${fileName} ━━━\n`;
                extractedContent += `[Unable to extract text content]\n`;
                
                attachmentSummary.push(`⚠️ ${fileName} (Text file, extraction failed)`);
            }
        } else {
            // Unknown file type
            extractedContent += `\n\n━━━ File: ${fileName} ━━━\n`;
            extractedContent += `[File type: ${fileType || 'Unknown'}]\n`;
            extractedContent += `[Size: ${attachment.size} bytes]\n`;
            extractedContent += `[Content extraction not supported for this file type]\n`;
            
            attachmentSummary.push(`❓ ${fileName} (Unknown type)`);
        }
        
    } catch (error) {
        console.error(`Error processing ${fileName}:`, error.message);
        extractedContent += `\n\n━━━ File: ${fileName} ━━━\n`;
        extractedContent += `[Processing error: ${error.message}]\n`;
        
        attachmentSummary.push(`❌ ${fileName} (Error)`);
    }
}

// Build the enhanced message
const originalMessage = inputData.body?.message || inputData.message || '';
let enhancedMessage = originalMessage.replace(/\[Context: User has .*?\]/g, '').trim();

if (attachments.length > 0) {
    // Add attachment summary at the beginning
    enhancedMessage = `${enhancedMessage}

📎 **Attached Files (${attachments.length}):**
${attachmentSummary.join('\n')}`;
    
    // Add extracted content if any
    if (extractedContent) {
        enhancedMessage += `\n\n📄 **Extracted Content:**${extractedContent}`;
    }
    
    // Add instruction for AI
    enhancedMessage += `\n\n**Important:** Please acknowledge and analyze ALL attached files in your response. Reference specific content from the documents when relevant to the user's question.`;
}

console.log(`\n=== Processing Complete ===`);
console.log(`Processed ${processedAttachments.length} of ${attachments.length} attachments`);
console.log(`Total extracted content: ${extractedContent.length} characters`);

// Return the enhanced data
return [{
    json: {
        ...inputData.body || inputData,
        message: enhancedMessage,
        originalMessage: originalMessage,
        attachmentCount: attachments.length,
        processedAttachments: processedAttachments,
        attachmentSummary: attachmentSummary,
        extractedContent: extractedContent,
        hasAttachments: attachments.length > 0,
        attachments: attachments // Keep original attachments
    }
}];