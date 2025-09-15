// Complete Document Processor for n8n
// Handles Word, Excel, PDF text extraction and Image OCR

const inputData = $input.all();
const webhookData = inputData[0]?.json || {};

// Get attachments
const attachments = webhookData.attachments || [];
const message = webhookData.message || webhookData.chatInput || '';
const sessionId = webhookData.sessionId || `session_${Date.now()}`;

// Azure Document Intelligence configuration
const endpoint = 'https://saxtech-document-intelligence.cognitiveservices.azure.com';
const apiKey = '5c1669e1c7f54a13ba42e58f5b2cfcc0';

// Function to extract text from Word documents using XML parsing
async function extractWordContent(base64Data) {
    try {
        // Remove data URL prefix if present
        const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
        
        // Decode base64 to binary
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use Azure Document Intelligence for Word documents
        const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;
        
        const response = await $http.post(analyzeUrl, bytes, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }
        });
        
        // Get the operation location from headers
        const operationLocation = response.headers['operation-location'] || response.headers['Operation-Location'];
        
        if (!operationLocation) {
            throw new Error('No operation location returned from Document Intelligence API');
        }
        
        // Poll for results
        let result = null;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await $http.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });
            
            if (statusResponse.data.status === 'succeeded') {
                result = statusResponse.data;
                break;
            } else if (statusResponse.data.status === 'failed') {
                throw new Error('Document analysis failed');
            }
            
            attempts++;
        }
        
        if (!result) {
            throw new Error('Document analysis timed out');
        }
        
        // Extract text from the result
        let extractedText = '';
        if (result.analyzeResult && result.analyzeResult.content) {
            extractedText = result.analyzeResult.content;
        } else if (result.analyzeResult && result.analyzeResult.pages) {
            // Fallback to extracting from pages
            extractedText = result.analyzeResult.pages
                .map(page => page.lines ? page.lines.map(line => line.content).join(' ') : '')
                .join('\n\n');
        }
        
        return extractedText || 'Could not extract text from Word document';
        
    } catch (error) {
        console.error('Error extracting Word content:', error);
        // Fallback: try basic text extraction
        return `[Word document - content extraction failed: ${error.message}]`;
    }
}

// Function to extract text from Excel files
async function extractExcelContent(base64Data) {
    try {
        // Remove data URL prefix if present
        const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
        
        // Decode base64 to binary
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use Azure Document Intelligence for Excel documents
        const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview`;
        
        const response = await $http.post(analyzeUrl, bytes, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });
        
        // Get the operation location from headers
        const operationLocation = response.headers['operation-location'] || response.headers['Operation-Location'];
        
        if (!operationLocation) {
            throw new Error('No operation location returned from Document Intelligence API');
        }
        
        // Poll for results
        let result = null;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await $http.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });
            
            if (statusResponse.data.status === 'succeeded') {
                result = statusResponse.data;
                break;
            } else if (statusResponse.data.status === 'failed') {
                throw new Error('Document analysis failed');
            }
            
            attempts++;
        }
        
        if (!result) {
            throw new Error('Document analysis timed out');
        }
        
        // Extract tables and content
        let extractedText = '';
        
        if (result.analyzeResult) {
            // Extract tables if present
            if (result.analyzeResult.tables && result.analyzeResult.tables.length > 0) {
                extractedText = 'Excel Tables:\n';
                result.analyzeResult.tables.forEach((table, idx) => {
                    extractedText += `\nTable ${idx + 1}:\n`;
                    if (table.cells) {
                        // Group cells by row
                        const rows = {};
                        table.cells.forEach(cell => {
                            if (!rows[cell.rowIndex]) rows[cell.rowIndex] = [];
                            rows[cell.rowIndex][cell.columnIndex] = cell.content || '';
                        });
                        
                        // Format as text table
                        Object.keys(rows).sort((a, b) => a - b).forEach(rowIdx => {
                            extractedText += rows[rowIdx].join(' | ') + '\n';
                        });
                    }
                });
            }
            
            // Also get general content
            if (result.analyzeResult.content) {
                extractedText += '\n\nAdditional Content:\n' + result.analyzeResult.content;
            }
        }
        
        return extractedText || 'Could not extract text from Excel document';
        
    } catch (error) {
        console.error('Error extracting Excel content:', error);
        return `[Excel document - content extraction failed: ${error.message}]`;
    }
}

// Function to perform OCR on images
async function performOCR(base64Data) {
    try {
        // Remove data URL prefix if present
        const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
        
        // Decode base64 to binary
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use Azure Document Intelligence OCR
        const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;
        
        const response = await $http.post(analyzeUrl, bytes, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Content-Type': 'application/octet-stream'
            }
        });
        
        // Get the operation location from headers
        const operationLocation = response.headers['operation-location'] || response.headers['Operation-Location'];
        
        if (!operationLocation) {
            throw new Error('No operation location returned from OCR API');
        }
        
        // Poll for results
        let result = null;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await $http.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });
            
            if (statusResponse.data.status === 'succeeded') {
                result = statusResponse.data;
                break;
            } else if (statusResponse.data.status === 'failed') {
                throw new Error('OCR analysis failed');
            }
            
            attempts++;
        }
        
        if (!result) {
            throw new Error('OCR analysis timed out');
        }
        
        // Extract text from OCR result
        let ocrText = '';
        if (result.analyzeResult && result.analyzeResult.content) {
            ocrText = result.analyzeResult.content;
        } else if (result.analyzeResult && result.analyzeResult.pages) {
            ocrText = result.analyzeResult.pages
                .map(page => page.lines ? page.lines.map(line => line.content).join(' ') : '')
                .join('\n\n');
        }
        
        return ocrText || 'No text detected in image';
        
    } catch (error) {
        console.error('OCR error:', error);
        return `[OCR failed: ${error.message}]`;
    }
}

// Main processing logic
async function processAttachments() {
    let extractedContent = '';
    
    if (attachments && attachments.length > 0) {
        console.log(`Processing ${attachments.length} attachments`);
        
        for (const attachment of attachments) {
            try {
                console.log(`Processing: ${attachment.name} (${attachment.type})`);
                
                if (!attachment.data) {
                    extractedContent += `\n[${attachment.name}: No data available]\n`;
                    continue;
                }
                
                // Determine file type and process accordingly
                if (attachment.type.includes('word') || attachment.name.endsWith('.docx')) {
                    // Word document
                    const wordContent = await extractWordContent(attachment.data);
                    extractedContent += `\n📄 Content from "${attachment.name}":\n${wordContent}\n`;
                    
                } else if (attachment.type.includes('excel') || attachment.type.includes('spreadsheet') || attachment.name.endsWith('.xlsx')) {
                    // Excel spreadsheet
                    const excelContent = await extractExcelContent(attachment.data);
                    extractedContent += `\n📊 Content from "${attachment.name}":\n${excelContent}\n`;
                    
                } else if (attachment.type.includes('image') || attachment.isScreenshot) {
                    // Image or screenshot - perform OCR
                    const ocrText = await performOCR(attachment.data);
                    extractedContent += `\n🖼️ Text from image "${attachment.name}":\n${ocrText}\n`;
                    
                } else if (attachment.type.includes('pdf')) {
                    // PDF - use Document Intelligence
                    extractedContent += `\n📑 PDF "${attachment.name}" - [PDF processing not yet implemented]\n`;
                    
                } else {
                    // Unknown type
                    extractedContent += `\n📎 File "${attachment.name}" (${attachment.type}) - [Unsupported file type]\n`;
                }
                
            } catch (error) {
                console.error(`Error processing ${attachment.name}:`, error);
                extractedContent += `\n[Error processing ${attachment.name}: ${error.message}]\n`;
            }
        }
    }
    
    return extractedContent;
}

// Process attachments and build output
const extractedContent = await processAttachments();

// Build the complete message for the AI
let chatInput = message;
if (extractedContent) {
    chatInput = `User message: ${message}\n\n--- Attached Document Content ---\n${extractedContent}\n\nPlease analyze the attached content and answer the user's question about it.`;
}

// Preserve all other fields from webhook
const output = {
    ...webhookData,
    chatInput: chatInput,
    message: message,
    sessionId: sessionId,
    extractedContent: extractedContent,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    processingComplete: true
};

console.log('Document processor output:', {
    hasAttachments: output.hasAttachments,
    attachmentCount: output.attachmentCount,
    extractedContentLength: extractedContent.length,
    chatInputLength: chatInput.length
});

return output;