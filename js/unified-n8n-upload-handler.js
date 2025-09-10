/**
 * Unified n8n Upload Handler for SAXTech MegaMind
 * Modified to follow the Foreman AI pattern - all uploads go through n8n webhook first
 * Version: 1.0.0
 * Created: 2025-09-10
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        webhooks: {
            // Primary n8n webhook for document upload (like Foreman AI)
            upload: 'https://workflows.saxtechnology.com/webhook/megamind/upload',
            index: 'https://workflows.saxtechnology.com/webhook/megamind/index',
            search: 'https://workflows.saxtechnology.com/webhook/megamind/search'
        },
        maxWebhookSize: 50 * 1024 * 1024, // 50MB limit for webhook
        enableChunking: true, // Enable chunking for large files
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        retryAttempts: 3,
        retryDelay: 1000 // milliseconds
    };
    
    /**
     * Main upload function - routes everything through n8n webhook
     * Following the Foreman AI pattern
     */
    window.uploadDocumentViaWebhook = async function(file, metadata = {}) {
        try {
            console.log('Starting unified n8n document upload:', file.name);
            
            // Validate file
            if (!file) {
                throw new Error('No file provided for upload');
            }
            
            // Check if file needs chunking
            if (file.size > CONFIG.maxWebhookSize && CONFIG.enableChunking) {
                console.log('Large file detected, will use chunked upload');
                return await uploadLargeFileChunked(file, metadata);
            }
            
            // Convert file to base64 (following Foreman AI pattern)
            const base64Data = await fileToBase64(file);
            
            // Calculate file hash for deduplication
            const fileHash = await calculateFileHash(base64Data);
            
            // Prepare upload payload (matching Foreman AI structure)
            const uploadPayload = {
                // File data
                file: base64Data,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
                fileHash: fileHash,
                
                // Metadata from the upload form
                department: metadata.department || 'general',
                documentType: metadata.sopType || metadata.documentType || 'general',
                title: metadata.title || file.name,
                description: metadata.description || '',
                keywords: metadata.keywords || '',
                version: metadata.version || '1.0',
                updateType: metadata.updateType || 'new',
                existingDocId: metadata.existingDocId || null,
                
                // Processing flags (like Foreman AI)
                enableOCR: shouldEnableOCR(file),
                generateEmbeddings: true,
                updateVectorIndex: true,
                extractEntities: true,
                
                // Client/category mapping from MegaMind's department structure
                client: mapDepartmentToClient(metadata.department),
                category: mapDocTypeToCategory(metadata.sopType || metadata.documentType),
                
                // Additional metadata
                uploadedBy: metadata.uploadedBy || 'SAX Portal User',
                uploadDate: new Date().toISOString(),
                source: 'SAX MegaMind Portal',
                
                // Processing instructions for n8n workflow
                processingType: determineProcessingType(file, metadata),
                workflowMode: 'unified', // Tells n8n to use unified processing
                
                // Deduplication strategy
                deduplicationStrategy: 'overwrite',
                overwriteExisting: true,
                updateIndex: true
            };
            
            // Send to n8n webhook (primary processing path)
            console.log('Sending document to n8n webhook for processing...');
            const result = await sendToWebhook(uploadPayload);
            
            console.log('Document successfully processed via n8n:', result);
            return result;
            
        } catch (error) {
            console.error('Error in unified n8n upload handler:', error);
            throw error;
        }
    };
    
    /**
     * Send payload to n8n webhook with retry logic
     */
    async function sendToWebhook(payload, attempt = 1) {
        try {
            const response = await fetch(CONFIG.webhooks.upload, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Webhook returned status ${response.status}`);
            }
            
            // Handle various response formats
            const contentType = response.headers.get('content-type');
            const responseText = await response.text();
            
            // Try to parse as JSON
            if (contentType && contentType.includes('application/json')) {
                try {
                    return JSON.parse(responseText);
                } catch (e) {
                    console.warn('Failed to parse JSON response:', e);
                }
            }
            
            // If not JSON or parse failed, return success with basic info
            return {
                success: true,
                fileName: payload.fileName,
                fileHash: payload.fileHash,
                message: 'Document processed successfully',
                rawResponse: responseText
            };
            
        } catch (error) {
            console.error(`Webhook attempt ${attempt} failed:`, error);
            
            // Retry logic
            if (attempt < CONFIG.retryAttempts) {
                console.log(`Retrying in ${CONFIG.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
                return sendToWebhook(payload, attempt + 1);
            }
            
            throw error;
        }
    }
    
    /**
     * Handle large file uploads with chunking
     */
    async function uploadLargeFileChunked(file, metadata) {
        console.log('Starting chunked upload for large file:', file.name);
        
        const chunks = await splitFileIntoChunks(file);
        const chunkResults = [];
        const sessionId = generateSessionId();
        
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Uploading chunk ${i + 1} of ${chunks.length}`);
            
            const chunkPayload = {
                ...metadata,
                file: chunks[i],
                fileName: file.name,
                mimeType: file.type,
                chunkIndex: i,
                totalChunks: chunks.length,
                sessionId: sessionId,
                isChunked: true
            };
            
            const result = await sendToWebhook(chunkPayload);
            chunkResults.push(result);
        }
        
        // Send completion signal
        const completionPayload = {
            sessionId: sessionId,
            fileName: file.name,
            totalChunks: chunks.length,
            action: 'complete_chunked_upload',
            metadata: metadata
        };
        
        return await sendToWebhook(completionPayload);
    }
    
    /**
     * Split file into chunks for large file handling
     */
    async function splitFileIntoChunks(file) {
        const chunks = [];
        const chunkSize = CONFIG.chunkSize;
        let offset = 0;
        
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize);
            const base64Chunk = await fileToBase64(chunk);
            chunks.push(base64Chunk);
            offset += chunkSize;
        }
        
        return chunks;
    }
    
    /**
     * Convert file to base64
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove the data:*/*;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }
    
    /**
     * Calculate SHA-256 hash of file content
     */
    async function calculateFileHash(base64Data) {
        try {
            const msgBuffer = new TextEncoder().encode(base64Data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (error) {
            console.warn('Could not calculate file hash:', error);
            return null;
        }
    }
    
    /**
     * Map MegaMind department to Foreman client structure
     */
    function mapDepartmentToClient(department) {
        const departmentMapping = {
            'it': 'sax-it',
            'hr': 'sax-hr',
            'finance': 'sax-finance',
            'operations': 'sax-operations',
            'sales': 'sax-sales',
            'marketing': 'sax-marketing',
            'legal': 'sax-legal',
            'compliance': 'sax-compliance',
            'general': 'sax-general'
        };
        
        return departmentMapping[department?.toLowerCase()] || 'sax-general';
    }
    
    /**
     * Map document type to category
     */
    function mapDocTypeToCategory(docType) {
        const typeMapping = {
            'policy': 'policies',
            'procedure': 'procedures',
            'form': 'forms',
            'template': 'templates',
            'guide': 'guides',
            'manual': 'manuals',
            'report': 'reports',
            'presentation': 'presentations',
            'spreadsheet': 'spreadsheets',
            'other': 'documents'
        };
        
        return typeMapping[docType?.toLowerCase()] || 'documents';
    }
    
    /**
     * Determine processing type based on file and metadata
     */
    function determineProcessingType(file, metadata) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type?.toLowerCase() || '';
        
        // Check for specific document types
        if (fileName.includes('sop') || metadata.sopType) {
            return 'sop-document';
        }
        
        if (fileName.includes('policy') || fileName.includes('procedure')) {
            return 'policy-document';
        }
        
        if (fileType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            return 'spreadsheet';
        }
        
        if (fileType.includes('presentation') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            return 'presentation';
        }
        
        if (fileType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i)) {
            return 'image-document';
        }
        
        return 'standard-document';
    }
    
    /**
     * Check if OCR should be enabled for the file
     */
    function shouldEnableOCR(file) {
        const ocrTypes = [
            'image/png', 
            'image/jpeg', 
            'image/jpg', 
            'image/gif', 
            'image/bmp', 
            'image/tiff',
            'application/pdf' // PDFs might need OCR for scanned content
        ];
        
        return ocrTypes.includes(file.type?.toLowerCase());
    }
    
    /**
     * Generate unique session ID for chunked uploads
     */
    function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Override the existing uploadDocument function to use n8n webhook
     * This ensures all existing code continues to work
     */
    if (window.uploadDocument) {
        console.log('Overriding existing uploadDocument with n8n webhook version');
        window._originalUploadDocument = window.uploadDocument;
    }
    
    window.uploadDocument = async function(formData) {
        console.log('uploadDocument called - routing through n8n webhook');
        
        // Extract data from FormData
        const file = formData.get('file');
        const metadata = {
            department: formData.get('department'),
            sopType: formData.get('sopType'),
            documentType: formData.get('documentType') || formData.get('sopType'),
            updateType: formData.get('updateType'),
            title: formData.get('title'),
            description: formData.get('description'),
            keywords: formData.get('keywords'),
            version: formData.get('version'),
            existingDocId: formData.get('existingDocId'),
            uploadedBy: formData.get('uploadedBy') || 'SAX Portal User'
        };
        
        // Use the webhook upload function
        return await window.uploadDocumentViaWebhook(file, metadata);
    };
    
    /**
     * Search documents via n8n webhook
     */
    window.searchDocumentsViaWebhook = async function(query, filters = {}) {
        const searchPayload = {
            query: query,
            filters: {
                department: filters.department,
                documentType: filters.documentType,
                dateRange: filters.dateRange,
                ...filters
            },
            options: {
                includeContent: true,
                maxResults: 50,
                generateSnippets: true
            }
        };
        
        try {
            const response = await fetch(CONFIG.webhooks.search, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload)
            });
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Search via webhook failed:', error);
            throw error;
        }
    };
    
    // Make config accessible for debugging
    window.UNIFIED_UPLOAD_CONFIG = CONFIG;
    
    console.log('✅ Unified n8n upload handler loaded - all documents will be processed through n8n workflows');
    console.log('Webhook URL:', CONFIG.webhooks.upload);
})();
