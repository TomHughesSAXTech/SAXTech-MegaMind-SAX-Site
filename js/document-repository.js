/**
 * Document Repository Manager
 * Handles document upload, display, preview, and download with Azure Blob Storage SAS tokens
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        azure: {
            storageAccount: 'saxtechmegamind',
            containerName: 'saxdocuments',
            functionApp: {
                baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
                key: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
                endpoints: {
                    search: '/documents/search',
                    process: '/documents/upload-json',  // Fixed endpoint
                    generateSAS: '/GenerateSASToken',
                    deleteDocument: '/documents/delete',  // Fixed endpoint
                    indexMaintenance: '/index/maintenance'
                }
            }
        },
        refreshInterval: 30000, // Refresh stats every 30 seconds
        uploadSteps: [
            { id: 'step-hash', text: 'Calculating document hash', duration: 1000 },
            { id: 'step-duplicate', text: 'Checking for duplicates', duration: 1500 },
            { id: 'step-chunk', text: 'Processing document chunks', duration: 2000 },
            { id: 'step-upload', text: 'Uploading to cloud storage', duration: 2500 },
            { id: 'step-index', text: 'Indexing for search', duration: 2000 },
            { id: 'step-embeddings', text: 'Creating embeddings', duration: 3000 }
        ]
    };

    // State
    let state = {
        documents: [],
        filteredDocuments: [],
        currentDepartment: '',
        searchTerm: '',
        selectedFile: null,
        isUploading: false,
        currentUploadStep: 0,
        lastIndexUpdate: null
    };

    // DOM Elements
    const elements = {
        // Form elements
        department: document.getElementById('department'),
        sopType: document.getElementById('sopType'),
        sopTitle: document.getElementById('sopTitle'),
        sopDescription: document.getElementById('sopDescription'),
        fileInput: document.getElementById('fileInput'),
        fileUploadArea: document.getElementById('fileUploadArea'),
        selectedFile: document.getElementById('selectedFile'),
        fileName: document.getElementById('fileName'),
        submitBtn: document.getElementById('submitBtn'),
        successMessage: document.getElementById('successMessage'),
        sopUploadForm: document.getElementById('sopUploadForm'),
        
        // Document browser elements
        searchInput: document.getElementById('searchInput'),
        departmentFilter: document.getElementById('departmentFilter'),
        documentGrid: document.getElementById('documentGrid'),
        documentCount: document.getElementById('documentCount'),
        
        // Stats elements
        totalDocCount: document.getElementById('totalDocCount'),
        totalIndexSize: document.getElementById('totalIndexSize'),
        lastIndexUpdate: document.getElementById('lastIndexUpdate'),
        
        // Modal elements
        uploadModal: document.getElementById('uploadModal'),
        modalProgressFill: document.getElementById('modalProgressFill'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        previewModal: document.getElementById('previewModal'),
        previewTitle: document.getElementById('previewTitle'),
        previewBody: document.getElementById('previewBody'),
        previewClose: document.getElementById('previewClose')
    };

    // Initialize
    function init() {
        setupEventListeners();
        loadIndexStatistics();
        loadDepartments();  // Load departments dynamically
        loadDocuments();
        
        // Set up auto-refresh for statistics
        setInterval(loadIndexStatistics, CONFIG.refreshInterval);
    }

    // Event Listeners
    function setupEventListeners() {
        // File upload events
        elements.fileUploadArea.addEventListener('click', () => elements.fileInput.click());
        elements.fileUploadArea.addEventListener('dragover', handleDragOver);
        elements.fileUploadArea.addEventListener('dragleave', handleDragLeave);
        elements.fileUploadArea.addEventListener('drop', handleDrop);
        elements.fileInput.addEventListener('change', handleFileSelect);
        
        // Form submission
        elements.sopUploadForm.addEventListener('submit', handleFormSubmit);
        
        // Search and filter
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
        elements.departmentFilter.addEventListener('change', handleDepartmentFilter);
        
        // Modal controls
        elements.modalCloseBtn.addEventListener('click', closeUploadModal);
        elements.previewClose.addEventListener('click', closePreviewModal);
        
        // Close preview modal on background click
        elements.previewModal.addEventListener('click', (e) => {
            if (e.target === elements.previewModal) {
                closePreviewModal();
            }
        });
    }

    // File Upload Handlers
    function handleDragOver(e) {
        e.preventDefault();
        elements.fileUploadArea.classList.add('dragover');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        elements.fileUploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        e.preventDefault();
        elements.fileUploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handleFileSelection(file);
        }
    }

    function handleFileSelection(file) {
        // Validate file type
        const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExt)) {
            showNotification('Invalid file type. Please select a supported document format.', 'error');
            return;
        }
        
        // Store file and update UI
        state.selectedFile = file;
        elements.fileName.textContent = file.name;
        elements.selectedFile.classList.remove('hidden');
        elements.fileUploadArea.style.display = 'none';
    }

    // Form Submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        if (!state.selectedFile) {
            showNotification('Please select a file to upload', 'error');
            return;
        }
        
        if (state.isUploading) {
            return;
        }
        
        state.isUploading = true;
        elements.submitBtn.disabled = true;
        
        // Show upload modal
        showUploadModal();
        
        // Prepare metadata
        const metadata = {
            department: elements.department.value,
            sopType: elements.sopType.value,
            documentType: elements.sopType.value,
            title: elements.sopTitle.value,
            description: elements.sopDescription.value,
            updateType: 'new'
        };
        
        try {
            // Simulate upload steps
            await simulateUploadSteps();
            
            // Use the unified n8n upload handler
            if (window.uploadDocumentViaWebhook) {
                await window.uploadDocumentViaWebhook(state.selectedFile, metadata);
            } else {
                // Fallback to direct upload
                await uploadDocumentDirect(state.selectedFile, metadata);
            }
            
            // Complete upload
            completeUpload();
            
            // Reset form
            resetForm();
            
            // Reload documents
            setTimeout(() => {
                loadDocuments();
                loadIndexStatistics();
            }, 2000);
            
        } catch (error) {
            console.error('Upload failed:', error);
            showNotification('Failed to upload document. Please try again.', 'error');
            closeUploadModal();
        } finally {
            state.isUploading = false;
            elements.submitBtn.disabled = false;
        }
    }

    // Upload Modal Management
    function showUploadModal() {
        elements.uploadModal.classList.add('active');
        state.currentUploadStep = 0;
        elements.modalProgressFill.style.width = '0%';
        
        // Reset all steps
        CONFIG.uploadSteps.forEach(step => {
            const stepEl = document.getElementById(step.id);
            stepEl.classList.remove('active', 'completed');
            stepEl.querySelector('.step-status').textContent = '';
        });
    }

    async function simulateUploadSteps() {
        for (let i = 0; i < CONFIG.uploadSteps.length; i++) {
            const step = CONFIG.uploadSteps[i];
            const stepEl = document.getElementById(step.id);
            
            // Activate current step
            stepEl.classList.add('active');
            
            // Update progress
            const progress = ((i + 1) / CONFIG.uploadSteps.length) * 100;
            elements.modalProgressFill.style.width = progress + '%';
            
            // Wait for step duration
            await new Promise(resolve => setTimeout(resolve, step.duration));
            
            // Complete step
            stepEl.classList.remove('active');
            stepEl.classList.add('completed');
            stepEl.querySelector('.step-status').textContent = '✓';
        }
    }

    function completeUpload() {
        elements.modalProgressFill.style.width = '100%';
        elements.modalCloseBtn.classList.add('visible');
        
        // Show success message
        const modalTitle = elements.uploadModal.querySelector('.modal-title');
        modalTitle.textContent = 'Upload Complete!';
        
        const modalSubtitle = elements.uploadModal.querySelector('.modal-subtitle');
        modalSubtitle.textContent = 'Your document has been successfully processed and indexed.';
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            closeUploadModal();
            showNotification('Document uploaded successfully!', 'success');
        }, 3000);
    }

    function closeUploadModal() {
        elements.uploadModal.classList.remove('active');
        elements.modalCloseBtn.classList.remove('visible');
        
        // Reset modal content
        const modalTitle = elements.uploadModal.querySelector('.modal-title');
        modalTitle.textContent = 'Processing Document';
        
        const modalSubtitle = elements.uploadModal.querySelector('.modal-subtitle');
        modalSubtitle.textContent = 'Please wait while we process your document';
    }

    function resetForm() {
        elements.sopUploadForm.reset();
        state.selectedFile = null;
        elements.selectedFile.classList.add('hidden');
        elements.fileUploadArea.style.display = 'block';
    }

    // Document Loading
    async function loadDocuments() {
        try {
            // Build query - match backend expectations
            let query = {
                query: state.searchTerm || '*',  // Changed from 'search' to 'query'
                department: state.currentDepartment || '',  // Direct department field
                documentType: '',  // Can add document type filter if needed
                page: 1,
                pageSize: 100
            };
            
            const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}${CONFIG.azure.functionApp.endpoints.search}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify(query)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Search API error:', errorText);
                throw new Error('Failed to load documents');
            }
            
            const data = await response.json();
            // Handle both response formats
            state.documents = data.value || data.results || [];
            
            displayDocuments();
            updateDocumentCount();
            
        } catch (error) {
            console.error('Error loading documents:', error);
            showNotification('Failed to load documents', 'error');
        }
    }

    // Document Display
    function displayDocuments() {
        if (state.documents.length === 0) {
            elements.documentGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <div class="empty-title">No Documents Found</div>
                    <div class="empty-text">
                        <p>Start by uploading documents using the form on the left, or adjust your filters to see more results.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        elements.documentGrid.innerHTML = '';
        
        state.documents.forEach(doc => {
            const card = createDocumentCard(doc);
            elements.documentGrid.appendChild(card);
        });
    }

    function createDocumentCard(doc) {
        const card = document.createElement('div');
        card.className = 'document-card';
        card.setAttribute('data-doc-id', doc.id);
        
        // Determine file type and icon
        const fileExt = getFileExtension(doc.fileName || doc.title);
        const iconClass = getIconClass(fileExt);
        const iconEmoji = getIconEmoji(fileExt);
        
        // Format metadata
        const uploadDate = formatDate(doc.uploadDate || doc.lastModified);
        const fileSize = formatFileSize(doc.fileSize);
        
        card.innerHTML = `
            <div class="document-icon ${iconClass}">
                ${iconEmoji}
                ${doc.indexed ? '<div class="indexed-badge">✓</div>' : ''}
            </div>
            <div class="document-info">
                <div class="document-title" title="${doc.title || doc.fileName}">
                    ${doc.title || doc.fileName || 'Untitled Document'}
                </div>
                <div class="document-meta">
                    <span class="meta-item">📅 ${uploadDate}</span>
                    ${fileSize ? `<span class="meta-item">💾 ${fileSize}</span>` : ''}
                    ${doc.department ? `<span class="meta-item">🏢 ${doc.department}</span>` : ''}
                    ${doc.author ? `<span class="meta-item">👤 ${doc.author}</span>` : ''}
                </div>
                ${doc.description ? `<div class="document-description">${doc.description}</div>` : ''}
            </div>
            <div class="document-actions">
                <button class="action-btn" onclick="documentRepository.previewDocument('${doc.id}', '${doc.title || doc.fileName}', '${doc.department}')">
                    <span>👁️</span> Preview
                </button>
                <button class="action-btn" onclick="documentRepository.downloadDocument('${doc.id}', '${doc.title || doc.fileName}', '${doc.department}')">
                    <span>⬇️</span> Download
                </button>
                <button class="btn-delete" onclick="documentRepository.deleteDocument('${doc.id}', '${doc.title || doc.fileName}', '${doc.department}')">
                    <span>🗑️</span>
                </button>
            </div>
        `;
        
        return card;
    }

    // Document Actions
    async function previewDocument(docId, fileName, department) {
        try {
            showPreviewModal(fileName);
            
            const fileExt = getFileExtension(fileName).toLowerCase();
            const previewContent = document.getElementById('previewContent');
            
            // Store current preview data for download button
            window.currentPreviewData = {
                docId: docId,
                fileName: fileName,
                department: department
            };
            
            // For private blob storage, we need to handle previews differently
            // Use Azure Function to proxy the document content
            const proxyUrl = `${CONFIG.azure.functionApp.baseUrl}/GetDocument?code=${CONFIG.azure.functionApp.key}`;
            
            // Create form data for the request
            const requestBody = {
                fileName: fileName,
                department: department || 'IT',
                containerName: CONFIG.azure.containerName || 'saxdocuments'
            };
            
            if (['pdf'].includes(fileExt)) {
                // For PDFs, create an iframe that loads through our proxy
                const sasToken = await generateSASToken(fileName, department);
                if (sasToken) {
                    const blobUrl = constructBlobUrl(fileName, department, sasToken);
                    
                    // Use the blob URL directly in an iframe
                    if (previewContent) {
                        previewContent.innerHTML = `
                            <iframe 
                                class="preview-iframe" 
                                src="${blobUrl}"
                                style="width: 100%; height: 100%; border: none; background: white;"
                                onload="this.style.opacity='1';"
                                onerror="this.parentElement.innerHTML='<div style=\'text-align:center;padding:40px;\'><p>Unable to load PDF preview.</p><button onclick=\'downloadFromPreview()\' style=\'padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;\'>Download Instead</button></div>';">
                            </iframe>
                        `;
                    }
                } else {
                    throw new Error('Could not generate SAS token');
                }
                
            } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt)) {
                // For Office documents, try to display in iframe
                const sasToken = await generateSASToken(fileName, department);
                if (sasToken) {
                    const blobUrl = constructBlobUrl(fileName, department, sasToken);
                    
                    if (previewContent) {
                        // Try to display in iframe - browser will either display or download
                        previewContent.innerHTML = `
                            <iframe 
                                class="preview-iframe" 
                                src="${blobUrl}"
                                style="width: 100%; height: 100%; border: none; background: white;"
                                onload="this.style.opacity='1';"
                                onerror="this.parentElement.innerHTML='<div style=\'text-align:center;padding:40px;\'><div style=\'font-size:48px;margin-bottom:20px;\'>📄</div><h3 style=\'margin-bottom:10px;\'>${fileName}</h3><p style=\'color:#6b7280;margin-bottom:20px;\'>This document will download to your computer.</p><button onclick=\'window.open(\"${blobUrl}\", \"_blank\")\'  style=\'padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;\'>Open/Download</button></div>';">
                            </iframe>
                            <div style="
                                position: absolute;
                                bottom: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: rgba(0, 0, 0, 0.8);
                                color: white;
                                padding: 8px 16px;
                                border-radius: 6px;
                                font-size: 12px;
                                z-index: 1000;
                            ">
                                If document doesn't display, 
                                <button onclick="window.open('${blobUrl}', '_blank')" style="
                                    background: #3b82f6;
                                    color: white;
                                    border: none;
                                    padding: 2px 8px;
                                    border-radius: 4px;
                                    margin: 0 4px;
                                    cursor: pointer;
                                ">Open in New Tab</button>
                                or
                                <button onclick="downloadFromPreview()" style="
                                    background: #10b981;
                                    color: white;
                                    border: none;
                                    padding: 2px 8px;
                                    border-radius: 4px;
                                    margin: 0 4px;
                                    cursor: pointer;
                                ">Download</button>
                            </div>
                        `;
                        
                        // Auto-hide the helper message after 5 seconds
                        setTimeout(() => {
                            const helperMsg = previewContent.querySelector('div[style*="position: absolute"]');
                            if (helperMsg) {
                                helperMsg.style.transition = 'opacity 0.5s';
                                helperMsg.style.opacity = '0';
                                setTimeout(() => helperMsg.remove(), 500);
                            }
                        }, 5000);
                    }
                } else {
                    throw new Error('Could not generate SAS token');
                }
                
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(fileExt)) {
                // For images, use SAS token URL directly
                const sasToken = await generateSASToken(fileName, department);
                if (sasToken) {
                    const blobUrl = constructBlobUrl(fileName, department, sasToken);
                    
                    if (previewContent) {
                        previewContent.innerHTML = `
                            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: auto; background: #f9fafb;">
                                <img 
                                    src="${blobUrl}" 
                                    style="max-width: 90%; max-height: 90%; object-fit: contain; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
                                    alt="${fileName}"
                                    onerror="this.parentElement.innerHTML='<p>Unable to load image.</p>';">
                            </div>
                        `;
                    }
                } else {
                    throw new Error('Could not generate SAS token');
                }
                
            } else if (['txt', 'json', 'xml', 'csv', 'log', 'md'].includes(fileExt)) {
                // For text files, fetch content using SAS token
                const sasToken = await generateSASToken(fileName, department);
                if (sasToken) {
                    const blobUrl = constructBlobUrl(fileName, department, sasToken);
                    
                    try {
                        const response = await fetch(blobUrl);
                        if (!response.ok) throw new Error('Failed to fetch document');
                        
                        const text = await response.text();
                        let formattedContent = text;
                        
                        // Format JSON files
                        if (fileExt === 'json') {
                            try {
                                const jsonObj = JSON.parse(text);
                                formattedContent = JSON.stringify(jsonObj, null, 2);
                            } catch (e) {
                                // Keep original if not valid JSON
                            }
                        }
                        
                        if (previewContent) {
                            previewContent.innerHTML = `
                                <div style="width: 100%; height: 100%; overflow: auto; background: #f5f5f5; padding: 20px; box-sizing: border-box;">
                                    <pre style="
                                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                                        font-size: 13px;
                                        line-height: 1.6;
                                        color: #1f2937;
                                        white-space: pre-wrap;
                                        word-wrap: break-word;
                                        margin: 0;
                                        background: white;
                                        padding: 20px;
                                        border-radius: 8px;
                                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                                    ">${escapeHtml(formattedContent)}</pre>
                                </div>
                            `;
                        }
                    } catch (error) {
                        console.error('Error loading text content:', error);
                        if (previewContent) {
                            previewContent.innerHTML = `
                                <div style="text-align: center; padding: 40px;">
                                    <p style="color: #ef4444; margin-bottom: 20px;">Unable to load document content</p>
                                    <button onclick="downloadFromPreview()" style="
                                        padding: 10px 20px;
                                        background: #3b82f6;
                                        color: white;
                                        border: none;
                                        border-radius: 6px;
                                        cursor: pointer;
                                    ">Download Instead</button>
                                </div>
                            `;
                        }
                    }
                } else {
                    throw new Error('Could not generate SAS token');
                }
                
            } else {
                // For unsupported file types, provide download option
                const sasToken = await generateSASToken(fileName, department);
                const blobUrl = sasToken ? constructBlobUrl(fileName, department, sasToken) : '#';
                
                if (previewContent) {
                    previewContent.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px;">📄</div>
                            <h3 style="margin-bottom: 10px; color: #1f2937;">${fileName}</h3>
                            <p style="color: #6b7280; margin-bottom: 20px;">Preview not available for ${fileExt.toUpperCase()} files</p>
                            <button onclick="downloadFromPreview()" style="
                                padding: 12px 24px;
                                background: #3b82f6;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                            ">⬇️ Download File</button>
                        </div>
                    `;
                }
            }
            
        } catch (error) {
            console.error('Preview error:', error);
            const previewContent = document.getElementById('previewContent');
            if (previewContent) {
                previewContent.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px; color: #ef4444;">⚠️</div>
                        <h3 style="margin-bottom: 10px; color: #1f2937;">Unable to Preview Document</h3>
                        <p style="color: #6b7280; margin-bottom: 30px;">${error.message || 'An error occurred while loading the preview'}</p>
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button onclick="downloadFromPreview()" style="
                                padding: 12px 24px;
                                background: #3b82f6;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                            ">Try Download</button>
                            <button onclick="closePreviewModal()" style="
                                padding: 12px 24px;
                                background: #f3f4f6;
                                color: #374151;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                            ">Close</button>
                        </div>
                    </div>
                `;
            }
        }
    }
    async function downloadDocument(docId, fileName, department) {
        try {
            // Generate SAS token for blob access
            const sasToken = await generateSASToken(fileName, department);
            
            if (sasToken) {
                const blobUrl = constructBlobUrl(fileName, department, sasToken);
                
                // Create temporary link and trigger download
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showNotification('Download started', 'success');
            } else {
                // Fallback to Azure Function
                const downloadUrl = `${CONFIG.azure.functionApp.baseUrl}/documents/download?id=${docId}&code=${CONFIG.azure.functionApp.key}`;
                window.open(downloadUrl, '_blank');
            }
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Unable to download document', 'error');
        }
    }

    async function deleteDocument(docId, fileName, department) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        
        try {
            console.log(`Starting deletion: ${fileName} from ${department} department`);
            
            // First, delete the blob from storage using the new direct function
            try {
                const deleteBlobUrl = `${CONFIG.azure.functionApp.baseUrl}/DeleteBlob?code=${CONFIG.azure.functionApp.key}`;
                
                const blobResponse = await fetch(deleteBlobUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-functions-key': CONFIG.azure.functionApp.key
                    },
                    body: JSON.stringify({
                        fileName: fileName,
                        department: department || 'IT', // Default to IT if department not provided
                        containerName: CONFIG.azure.containerName || 'saxdocuments'
                    })
                });
                
                if (blobResponse.ok) {
                    const blobResult = await blobResponse.json();
                    console.log('Blob deletion result:', blobResult);
                } else {
                    console.warn('Blob deletion failed, continuing with index deletion');
                }
            } catch (blobError) {
                console.error('Error deleting blob:', blobError);
                // Continue with index deletion even if blob deletion fails
            }
            
            // Then delete from search index
            const deleteUrl = `${CONFIG.azure.functionApp.baseUrl}/documents/delete/${docId}?code=${CONFIG.azure.functionApp.key}`;
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    showNotification(`Document "${fileName}" deleted successfully`, 'success');
                    
                    // Remove the document card from the UI immediately
                    const documentCard = document.querySelector(`[data-doc-id="${docId}"]`);
                    if (documentCard) {
                        documentCard.remove();
                    }
                    
                    // Reload documents and statistics
                    setTimeout(() => {
                        loadDocuments();
                        loadIndexStatistics();
                    }, 1000);
                } else {
                    throw new Error(result.message || 'Delete failed');
                }
            } else {
                const errorText = await response.text();
                console.error('Delete API error:', errorText);
                throw new Error('Delete failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showNotification('Unable to delete document', 'error');
        }
    }

    // SAS Token Generation
    async function generateSASToken(fileName, department) {
        try {
            // Call Azure Function to generate SAS token
            const url = `${CONFIG.azure.functionApp.baseUrl}/GenerateSASToken?code=${CONFIG.azure.functionApp.key}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: fileName,
                    department: department,
                    containerName: CONFIG.azure.containerName,
                    expiryMinutes: 60 // Token valid for 1 hour
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.sasToken;
            }
        } catch (error) {
            console.error('Failed to generate SAS token:', error);
        }
        
        return null;
    }

    function constructBlobUrl(fileName, department, sasToken) {
        const baseUrl = `https://${CONFIG.azure.storageAccount}.blob.core.windows.net`;
        const container = CONFIG.azure.containerName;
        const path = `${department}/${fileName}`;  // Correct path without original-documents
        
        return `${baseUrl}/${container}/${path}?${sasToken}`;
    }

    // Search and Filter
    function handleSearch() {
        state.searchTerm = elements.searchInput.value.trim();
        loadDocuments();
    }

    function handleDepartmentFilter() {
        const selectedValue = elements.departmentFilter.value;
        // Empty string for 'All Departments', otherwise use the selected value
        state.currentDepartment = selectedValue === '' ? '' : selectedValue;
        console.log('Department filter changed to:', state.currentDepartment || 'All Departments');
        loadDocuments();
    }

    // Load departments dynamically from Azure
    async function loadDepartments() {
        try {
            const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}${CONFIG.azure.functionApp.endpoints.indexMaintenance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify({
                    operation: 'list-departments'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.departments) {
                    updateDepartmentFilter(data.departments);
                }
            }
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }
    
    // Update department filter with dynamic departments
    function updateDepartmentFilter(departments) {
        if (elements.departmentFilter) {
            // Save current selection
            const currentValue = elements.departmentFilter.value;
            
            // Clear existing options except the first (empty) one
            while (elements.departmentFilter.options.length > 1) {
                elements.departmentFilter.remove(1);
            }
            
            // Add departments from Azure
            departments.forEach(dept => {
                if (dept && dept !== 'converted-documents' && dept !== 'original-documents') {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept.charAt(0).toUpperCase() + dept.slice(1);
                    elements.departmentFilter.appendChild(option);
                }
            });
            
            // Restore selection if it still exists
            if (currentValue && Array.from(elements.departmentFilter.options).some(opt => opt.value === currentValue)) {
                elements.departmentFilter.value = currentValue;
            }
        }
    }
    
    // Statistics
    async function loadIndexStatistics() {
        try {
            // Use Azure Function to get statistics
            const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}${CONFIG.azure.functionApp.endpoints.indexMaintenance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify({
                    operation: 'stats'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Update document count from stats
                const totalDocs = data.stats?.totalDocuments || 0;
                elements.totalDocCount.textContent = totalDocs.toLocaleString();
                
                // Estimate index size (approximate)
                const avgDocSize = 50; // KB average
                const totalSizeMB = (totalDocs * avgDocSize / 1024).toFixed(1);
                elements.totalIndexSize.textContent = `${totalSizeMB} MB`;
                
                // Get last update time from stats
                if (data.stats?.lastUpdated) {
                    elements.lastIndexUpdate.textContent = data.stats.lastUpdated;
                    state.lastIndexUpdate = data.stats.lastUpdated;
                } else {
                    elements.lastIndexUpdate.textContent = '--';
                }
            }
        } catch (error) {
            console.error('Failed to load index statistics:', error);
        }
    }

    // Modal Management
    function showPreviewModal(title) {
        const modal = document.getElementById('previewModal');
        const titleElement = document.getElementById('previewTitle');
        const bodyElement = document.getElementById('previewContent');
        
        if (titleElement) titleElement.textContent = title || 'Document Preview';
        if (bodyElement) bodyElement.innerHTML = '<div class="spinner" style="margin: 40px auto; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex'; // Ensure display is set
        }
    }

    function closePreviewModal() {
        const modal = document.getElementById('previewModal');
        const bodyElement = document.getElementById('previewContent');
        
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        if (bodyElement) bodyElement.innerHTML = '';
    }

    // Utility Functions
    function updateDocumentCount() {
        const count = state.documents.length;
        const dept = state.currentDepartment || 'all departments';
        elements.documentCount.textContent = `${count} document${count !== 1 ? 's' : ''}${state.currentDepartment ? ' in ' + dept : ''}`;
    }

    function getFileExtension(fileName) {
        if (!fileName) return 'unknown';
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : 'unknown';
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function getIconClass(ext) {
        const iconMap = {
            'pdf': 'pdf',
            'doc': 'word',
            'docx': 'word',
            'xls': 'excel',
            'xlsx': 'excel',
            'ppt': 'powerpoint',
            'pptx': 'powerpoint',
            'txt': 'text',
            'csv': 'excel'
        };
        return iconMap[ext] || 'text';
    }

    function getIconEmoji(ext) {
        const emojiMap = {
            'pdf': '📕',
            'doc': '📘',
            'docx': '📘',
            'xls': '📗',
            'xlsx': '📗',
            'ppt': '📙',
            'pptx': '📙',
            'txt': '📄',
            'csv': '📊'
        };
        return emojiMap[ext] || '📄';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function formatDateTime(date) {
        if (!date) return '--';
        return date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return null;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            'success': '✓',
            'error': '✗',
            'warning': '⚠',
            'info': 'ℹ'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${iconMap[type] || iconMap.info}</span>
            <span class="notification-text">${message}</span>
            <button class="notification-close">✕</button>
        `;
        
        document.body.appendChild(notification);
        
        // Add close handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Fallback direct upload (if n8n is unavailable)
    async function uploadDocumentDirect(file, metadata) {
        const formData = new FormData();
        formData.append('file', file);
        Object.keys(metadata).forEach(key => {
            formData.append(key, metadata[key]);
        });
        
        const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}/documents/upload`, {
            method: 'POST',
            headers: {
                'x-functions-key': CONFIG.azure.functionApp.key
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        return response.json();
    }

    // Public API
    window.documentRepository = {
        previewDocument,
        downloadDocument,
        deleteDocument,
        refresh: () => {
            loadDocuments();
            loadIndexStatistics();
        }
    };
    
    // Global helper functions for modal buttons
    window.downloadFromPreview = function() {
        if (window.currentPreviewData) {
            downloadDocument(
                window.currentPreviewData.docId,
                window.currentPreviewData.fileName,
                window.currentPreviewData.department
            );
        }
    };
    
    window.closePreviewModal = closePreviewModal;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
