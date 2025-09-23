// Multipart upload handler for large files
async function uploadDocumentMultipart(formData) {
    try {
        const file = formData.get('file');
        
        // Validate file exists
        if (!file || file.size === 0) {
            throw new Error('No file selected or file is empty');
        }
        
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size,
            sizeMB: (file.size / (1024 * 1024)).toFixed(2)
        });
        
        // Determine upload method based on file size
        const useMultipart = file.size > 1.5 * 1024 * 1024; // 1.5MB threshold
        
        let response;
        
        if (useMultipart) {
            console.log('Using multipart upload for large file (>' + (file.size / (1024 * 1024)).toFixed(2) + 'MB)...');
            
            // Update progress
            if (window.updateUploadProgress) {
                window.updateUploadProgress('duplicate', 'Checking for duplicates...');
            }
            
            // Create FormData for multipart upload
            const multipartData = new FormData();
            
            // Add the actual file
            multipartData.append('file', file);
            
            // Add metadata fields individually for n8n to parse
            multipartData.append('fileName', file.name);
            multipartData.append('fileType', file.type || 'application/octet-stream');
            multipartData.append('department', formData.get('department') || 'General');
            multipartData.append('documentType', formData.get('sopType') || 'SOP');
            multipartData.append('title', formData.get('title') || file.name);
            multipartData.append('description', formData.get('description') || '');
            multipartData.append('keywords', formData.get('keywords') || '');
            multipartData.append('version', formData.get('version') || '1.0');
            multipartData.append('updateType', formData.get('updateType') || 'new');
            multipartData.append('existingDocId', formData.get('existingDocId') || '');
            multipartData.append('uploadedBy', 'SAX Portal User');
            multipartData.append('uploadDate', new Date().toISOString());
            multipartData.append('source', 'SAX Document Portal');
            
            console.log('Uploading via multipart to n8n workflow...');
            
            // Update progress
            if (window.updateUploadProgress) {
                window.updateUploadProgress('upload', 'Uploading to cloud storage...');
            }
            
            // Send as multipart/form-data (no Content-Type header, browser sets it with boundary)
            response = await fetch(API_CONFIG.n8n.webhookUrl, {
                method: 'POST',
                body: multipartData
            });
            
        } else {
            console.log('Using base64 upload for small file (<1.5MB)...');
            
            // Update progress
            if (window.updateUploadProgress) {
                window.updateUploadProgress('duplicate', 'Checking for duplicates...');
            }
            
            // Convert file to base64 for small files
            const fileContent = await fileToBase64(file);
            
            // Validate base64 content
            if (!fileContent || fileContent.length === 0) {
                throw new Error('Failed to convert file to base64');
            }
            
            console.log('Base64 content generated, length:', fileContent.length);
            
            // Calculate file hash for deduplication (optional for small files)
            const fileHash = await window.documentEnhancements?.calculateSHA256(file) || null;
            
            // Get the selected department
            const selectedDepartment = formData.get('department');
            
            // Create the JSON payload for small files
            const n8nPayload = {
                // Flat structure for backward compatibility
                fileName: file.name,
                fileContent: fileContent,
                mimeType: file.type || 'application/octet-stream',
                department: selectedDepartment || 'General',
                documentType: formData.get('sopType') || 'SOP',
                title: formData.get('title') || file.name,
                description: formData.get('description') || '',
                keywords: formData.get('keywords') || '',
                version: formData.get('version') || '1.0',
                updateType: formData.get('updateType') || 'new',
                existingDocId: formData.get('existingDocId') || null,
                uploadedBy: 'SAX Portal User',
                uploadDate: new Date().toISOString(),
                source: 'SAX Document Portal',
                // Nested structure for compatibility
                file: {
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    size: file.size,
                    content: fileContent
                },
                metadata: {
                    department: selectedDepartment || 'General',
                    documentType: formData.get('sopType'),
                    title: formData.get('title') || file.name,
                    description: formData.get('description') || '',
                    keywords: formData.get('keywords') || '',
                    version: formData.get('version') || '1.0',
                    updateType: formData.get('updateType'),
                    existingDocId: formData.get('existingDocId') || null,
                    uploadedBy: 'SAX Portal User',
                    uploadDate: new Date().toISOString(),
                    source: 'SAX Document Portal',
                    sha256Hash: fileHash,
                    contentHash: fileHash
                }
            };
            
            console.log('Uploading JSON to n8n workflow...');
            
            // Update progress
            if (window.updateUploadProgress) {
                window.updateUploadProgress('upload', 'Uploading to cloud storage...');
            }
            
            // Send as JSON for small files
            response = await fetch(API_CONFIG.n8n.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(n8nPayload)
            });
        }
        
        // Handle response
        if (!response.ok) {
            // Show error immediately without updating progress to indexing
            if (window.showUploadError) {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    const errorMessage = errorJson.error?.message || errorJson.message || `HTTP ${response.status}`;
                    window.showUploadError(errorMessage);
                } catch (e) {
                    window.showUploadError(`Upload failed: HTTP ${response.status} - ${errorText}`);
                }
            }
            const errorText = await response.text();
            console.error('n8n webhook error response:', errorText);
            
            // Error was already handled above - just throw to be caught by caller
            throw new Error('Upload failed - see modal for details');
        }
        
        // Update progress to indexing now that upload succeeded
        if (window.updateUploadProgress) {
            window.updateUploadProgress('index', 'Indexing for search...');
        }
        
        const result = await response.json();
        console.log('Document uploaded successfully:', result);
        
        // Check for errors in the result
        if (result.success === false) {
            if (window.showUploadError) {
                const errorMessage = result.message || result.error || 'Upload failed';
                window.showUploadError(errorMessage);
                throw new Error('Upload failed - see modal for details');
            } else {
                throw new Error(result.message || result.error || 'Upload failed');
            }
        }
        
        // Update progress for embeddings only after successful indexing
        if (window.updateUploadProgress) {
            window.updateUploadProgress('embeddings', 'Creating embeddings...');
        }
        
        return result;
    } catch (error) {
        console.error('Upload failed:', error);
        throw error;
    }
}