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
                    search: '/DocumentsSearch',
                    process: '/documents-upload-json',
                    generateSAS: '/GenerateSASToken',
                    deleteDocument: '/documents-delete',
                    indexMaintenance: '/IndexMaintenance'
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
            // Build query
            let query = {
                search: state.searchTerm || '*',
                select: 'id,title,fileName,documentType,description,uploadDate,lastModified,department,fileSize,author,blobUrl',
                top: 100,
                orderby: 'uploadDate desc'
            };
            
            // Add department filter if selected
            if (state.currentDepartment) {
                query.filter = `department eq '${state.currentDepartment}'`;
            }
            
            const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}${CONFIG.azure.functionApp.endpoints.search}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify(query)
            });
            
            if (!response.ok) {
                throw new Error('Failed to load documents');
            }
            
            const data = await response.json();
            state.documents = data.value || [];
            
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
                <button class="btn-delete" onclick="documentRepository.deleteDocument('${doc.id}', '${doc.title || doc.fileName}')">
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
            
            // Generate SAS token for blob access
            const sasToken = await generateSASToken(fileName, department);
            
            if (sasToken) {
                const blobUrl = constructBlobUrl(fileName, department, sasToken);
                
                // Create iframe for preview
                const iframe = document.createElement('iframe');
                iframe.className = 'preview-iframe';
                iframe.src = blobUrl;
                
                elements.previewBody.innerHTML = '';
                elements.previewBody.appendChild(iframe);
            } else {
                // Fallback to Azure Function
                const previewUrl = `${CONFIG.azure.functionApp.baseUrl}/documents/preview?id=${docId}&code=${CONFIG.azure.functionApp.key}`;
                window.open(previewUrl, '_blank');
                closePreviewModal();
            }
        } catch (error) {
            console.error('Preview error:', error);
            showNotification('Unable to preview document', 'error');
            closePreviewModal();
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

    async function deleteDocument(docId, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        
        try {
            // Use Azure Function to delete document (handles both blob and index)
            const deleteUrl = `${CONFIG.azure.functionApp.baseUrl}/documents-delete`;
            
            const response = await fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify({
                    documentIds: [docId]
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    showNotification(`Document "${fileName}" deleted successfully`, 'success');
                    
                    // Reload documents
                    setTimeout(() => {
                        loadDocuments();
                        loadIndexStatistics();
                    }, 1000);
                } else {
                    throw new Error(result.message || 'Delete failed');
                }
            } else {
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
            const response = await fetch(`${CONFIG.azure.functionApp.baseUrl}/GenerateSASToken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.azure.functionApp.key
                },
                body: JSON.stringify({
                    fileName: fileName,
                    department: department,
                    containerName: CONFIG.azure.containerName,
                    blobPath: `${department}/${fileName}`,  // Correct path without original-documents
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
        state.currentDepartment = elements.departmentFilter.value;
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
        elements.previewTitle.textContent = title || 'Document Preview';
        elements.previewBody.innerHTML = '<div class="spinner"></div>';
        elements.previewModal.classList.add('active');
    }

    function closePreviewModal() {
        elements.previewModal.classList.remove('active');
        elements.previewBody.innerHTML = '';
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
