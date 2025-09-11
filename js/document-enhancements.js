/**
 * Document Management Enhancements
 * Includes deduplication, chunking, status tracking, and department management
 */

class DocumentEnhancements {
    constructor() {
        this.chunkSize = 1000; // Characters per chunk for large documents
        this.maxFileSize = 50 * 1024 * 1024; // 50MB max for chunking
        this.init();
    }

    init() {
        // Initialize enhancement features
        // Removed setupDepartmentManagement since departments come from blob storage
        this.setupUploadStatusTracking();
    }

    /**
     * 1. DEDUPLICATION - Calculate SHA256 hash of file
     */
    async calculateSHA256(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * Check for duplicate documents in the index
     */
    async checkDuplicate(fileHash, fileName) {
        try {
            // Use Azure Function for search (assuming API_CONFIG is available)
            const API_CONFIG = window.API_CONFIG || {
                baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
                functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
                endpoints: { search: '/documents/search' }
            };
            
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': API_CONFIG.functionKey
                },
                body: JSON.stringify({
                    search: fileHash,
                    searchFields: 'contentHash,sha256Hash',
                    select: 'id,title,fileName,uploadDate,department',
                    top: 1
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.value && data.value.length > 0) {
                    return data.value[0]; // Return duplicate document info
                }
            }
        } catch (error) {
            console.error('Duplicate check failed:', error);
        }
        return null;
    }

    /**
     * 2. LARGE PDF CHUNKING - Split large documents into chunks
     */
    async chunkDocument(file) {
        const chunks = [];
        const text = await this.extractTextFromFile(file);
        
        if (!text) {
            // If text extraction fails, return file as single chunk
            return [{
                content: await this.fileToBase64(file),
                chunkIndex: 0,
                totalChunks: 1,
                type: 'binary'
            }];
        }

        // Calculate number of chunks needed
        const totalChunks = Math.ceil(text.length / this.chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, text.length);
            
            // Try to break at sentence boundaries
            let chunkEnd = end;
            if (end < text.length) {
                const lastPeriod = text.lastIndexOf('.', end);
                const lastNewline = text.lastIndexOf('\n', end);
                chunkEnd = Math.max(lastPeriod, lastNewline) > start ? 
                    Math.max(lastPeriod, lastNewline) + 1 : end;
            }
            
            chunks.push({
                content: text.substring(start, chunkEnd),
                chunkIndex: i,
                totalChunks: totalChunks,
                type: 'text',
                startChar: start,
                endChar: chunkEnd
            });
        }
        
        return chunks;
    }

    /**
     * Extract text from various file types
     */
    async extractTextFromFile(file) {
        const fileType = file.type.toLowerCase();
        
        // For text-based files, read directly
        if (fileType.includes('text') || fileType.includes('json') || fileType.includes('xml')) {
            return await file.text();
        }
        
        // For PDFs and other complex formats, we'll need server-side processing
        // Return null to indicate binary handling needed
        return null;
    }

    /**
     * Convert file to base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    /**
     * 3. REAL UPLOAD STATUS - Enhanced progress tracking
     */
    setupUploadStatusTracking() {
        // Create status overlay if it doesn't exist
        if (!document.getElementById('uploadStatusOverlay')) {
            const statusHTML = `
                <div id="uploadStatusOverlay" style="
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10000;
                    justify-content: center;
                    align-items: center;
                ">
                    <div style="
                        background: white;
                        border-radius: 12px;
                        padding: 24px;
                        max-width: 500px;
                        width: 90%;
                    ">
                        <h3 style="margin: 0 0 16px 0; color: #1e293b;">Processing Document</h3>
                        
                        <div id="uploadStages" style="margin: 16px 0;">
                            <div class="upload-stage" id="stage-hash">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Calculating document hash...</span>
                            </div>
                            <div class="upload-stage" id="stage-duplicate">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Checking for duplicates...</span>
                            </div>
                            <div class="upload-stage" id="stage-chunk">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Processing document chunks...</span>
                            </div>
                            <div class="upload-stage" id="stage-upload">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Uploading to cloud storage...</span>
                            </div>
                            <div class="upload-stage" id="stage-index">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Indexing for search...</span>
                            </div>
                            <div class="upload-stage" id="stage-vector">
                                <span class="stage-icon">⏳</span>
                                <span class="stage-text">Creating embeddings...</span>
                            </div>
                        </div>
                        
                        <div style="
                            background: #f1f5f9;
                            border-radius: 8px;
                            height: 8px;
                            overflow: hidden;
                            margin: 16px 0;
                        ">
                            <div id="uploadProgressBar" style="
                                background: linear-gradient(90deg, #3b82f6, #06b6d4);
                                height: 100%;
                                width: 0%;
                                transition: width 0.3s ease;
                            "></div>
                        </div>
                        
                        <div id="uploadStatusMessage" style="
                            font-size: 12px;
                            color: #64748b;
                            text-align: center;
                        ">Initializing...</div>
                    </div>
                </div>
                
                <style>
                    .upload-stage {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 0;
                        font-size: 14px;
                        color: #64748b;
                    }
                    .upload-stage.active {
                        color: #3b82f6;
                        font-weight: 500;
                    }
                    .upload-stage.completed {
                        color: #10b981;
                    }
                    .upload-stage.error {
                        color: #ef4444;
                    }
                    .stage-icon {
                        font-size: 16px;
                    }
                    .upload-stage.completed .stage-icon::before {
                        content: '✅';
                    }
                    .upload-stage.active .stage-icon::before {
                        content: '⚡';
                    }
                    .upload-stage.error .stage-icon::before {
                        content: '❌';
                    }
                </style>
            `;
            document.body.insertAdjacentHTML('beforeend', statusHTML);
        }
    }

    /**
     * Update upload status display
     */
    updateUploadStatus(stage, status, message) {
        const overlay = document.getElementById('uploadStatusOverlay');
        const stageElement = document.getElementById(`stage-${stage}`);
        const statusMessage = document.getElementById('uploadStatusMessage');
        const progressBar = document.getElementById('uploadProgressBar');
        
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        if (stageElement) {
            // Remove all status classes
            stageElement.classList.remove('active', 'completed', 'error');
            // Add appropriate class
            stageElement.classList.add(status);
        }
        
        if (statusMessage && message) {
            statusMessage.textContent = message;
        }
        
        // Update progress bar
        const stages = ['hash', 'duplicate', 'chunk', 'upload', 'index', 'vector'];
        const currentIndex = stages.indexOf(stage);
        if (currentIndex !== -1 && progressBar) {
            const progress = ((currentIndex + (status === 'completed' ? 1 : 0.5)) / stages.length) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }

    /**
     * Hide upload status overlay
     */
    hideUploadStatus() {
        const overlay = document.getElementById('uploadStatusOverlay');
        if (overlay) {
            setTimeout(() => {
                overlay.style.display = 'none';
                // Reset all stages
                document.querySelectorAll('.upload-stage').forEach(stage => {
                    stage.classList.remove('active', 'completed', 'error');
                });
            }, 2000);
        }
    }

    /**
     * 4. DEPARTMENT MANAGEMENT - Add ability to dynamically add departments
     */
    setupDepartmentManagement() {
        // Add department management button if it doesn't exist
        const departmentSelect = document.getElementById('department');
        if (departmentSelect && !document.getElementById('addDepartmentBtn')) {
            const addButton = document.createElement('button');
            addButton.id = 'addDepartmentBtn';
            addButton.type = 'button';
            addButton.textContent = '+ Add Department';
            addButton.style.cssText = `
                margin-top: 8px;
                padding: 6px 12px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                width: 100%;
            `;
            addButton.onclick = () => this.showAddDepartmentDialog();
            departmentSelect.parentElement.appendChild(addButton);
        }
    }

    /**
     * Show dialog to add new department
     */
    showAddDepartmentDialog() {
        const departmentName = prompt('Enter new department name:');
        if (departmentName && departmentName.trim()) {
            this.addDepartment(departmentName.trim());
        }
    }

    /**
     * Add new department to the select list
     */
    addDepartment(departmentName) {
        const departmentSelect = document.getElementById('department');
        if (departmentSelect) {
            // Check if department already exists
            const exists = Array.from(departmentSelect.options).some(
                option => option.value === departmentName
            );
            
            if (!exists) {
                const option = document.createElement('option');
                option.value = departmentName;
                option.textContent = departmentName;
                departmentSelect.appendChild(option);
                
                // Save to localStorage for persistence
                this.saveDepartments();
                
                alert(`Department "${departmentName}" added successfully!`);
            } else {
                alert('This department already exists.');
            }
        }
    }

    /**
     * Save departments to localStorage AND Azure (for centralized storage)
     */
    async saveDepartments() {
        const departmentSelect = document.getElementById('department');
        if (departmentSelect) {
            // Define the hardcoded departments that should NOT be saved
            const hardcodedDepartments = [
                'A&A', 'Audit & Advisory',
                'Finance',
                'HR', 'Human Resources',
                'Leadership',
                'Marketing/Business Development', 'Marketing & Business Development',
                'Operations',
                'Shared Services',
                'Tax', 'Tax Services',
                'Transaction Advisory',
                'Wealth Management'
            ];
            
            // Only save departments that are NOT in the hardcoded list
            const departments = Array.from(departmentSelect.options)
                .filter(opt => opt.value && !hardcodedDepartments.includes(opt.value) && !hardcodedDepartments.includes(opt.textContent))
                .map(opt => ({ value: opt.value, text: opt.textContent }));
            
            // Save to localStorage for immediate use
            localStorage.setItem('customDepartments', JSON.stringify(departments));
            
            // Also save to Azure for centralized storage (all users will see these)
            try {
                const API_CONFIG = window.API_CONFIG || {
                    baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
                    functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
                    endpoints: { indexMaintenance: '/index/maintenance' }
                };
                
                // Save custom departments to Azure
                await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.indexMaintenance}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-functions-key': API_CONFIG.functionKey
                    },
                    body: JSON.stringify({
                        operation: 'save-custom-departments',
                        departments: departments
                    })
                });
            } catch (error) {
                console.error('Failed to save departments to Azure:', error);
            }
        }
    }

    /**
     * Load saved departments from localStorage
     */
    loadSavedDepartments() {
        const saved = localStorage.getItem('customDepartments');
        if (saved) {
            try {
                const departments = JSON.parse(saved);
                const departmentSelect = document.getElementById('department');
                if (departmentSelect) {
                    // Add any custom departments not already in the list
                    departments.forEach(dept => {
                        const exists = Array.from(departmentSelect.options).some(
                            option => option.value === dept.value
                        );
                        if (!exists) {
                            const option = document.createElement('option');
                            option.value = dept.value;
                            option.textContent = dept.text;
                            departmentSelect.appendChild(option);
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading saved departments:', error);
            }
        }
    }

    /**
     * 5. SEARCH TOOL FUNCTIONS - Department-specific search
     */
    
    /**
     * Search all documents excluding L&D department
     */
    async searchAllExceptLD(searchTerm) {
        const API_CONFIG = window.API_CONFIG || {
            baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
            functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
            endpoints: { search: '/documents/search' }
        };
        
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': API_CONFIG.functionKey
            },
            body: JSON.stringify({
                search: searchTerm,
                filter: "department ne 'L&D' and department ne 'Learning & Development'",
                searchMode: 'all',
                queryType: 'full',
                select: 'id,title,fileName,department,description,uploadDate',
                top: 50,
                orderby: 'search.score() desc'
            })
        });
        
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Search failed');
    }

    /**
     * Search only L&D department documents
     */
    async searchLDOnly(searchTerm) {
        const API_CONFIG = window.API_CONFIG || {
            baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
            functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
            endpoints: { search: '/documents/search' }
        };
        
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': API_CONFIG.functionKey
            },
            body: JSON.stringify({
                search: searchTerm,
                filter: "department eq 'L&D' or department eq 'Learning & Development'",
                searchMode: 'all',
                queryType: 'full',
                select: 'id,title,fileName,department,description,uploadDate',
                top: 50,
                orderby: 'search.score() desc'
            })
        });
        
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Search failed');
    }

    /**
     * Search specific department
     */
    async searchByDepartment(searchTerm, department) {
        const API_CONFIG = window.API_CONFIG || {
            baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
            functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
            endpoints: { search: '/documents/search' }
        };
        
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': API_CONFIG.functionKey
            },
            body: JSON.stringify({
                search: searchTerm,
                filter: `department eq '${department.replace(/'/g, "''")}'`,
                searchMode: 'all',
                queryType: 'full',
                select: 'id,title,fileName,department,description,uploadDate',
                top: 50,
                orderby: 'search.score() desc'
            })
        });
        
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Search failed');
    }

    /**
     * 6. DEPARTMENT DROPDOWN IN REPOSITORY - Add filter dropdown
     */
    addDepartmentFilter() {
        // Instead of adding a new filter, let's make the sidebar department dropdown trigger loading
        // when the page doesn't have documents loaded yet
        const departmentSelect = document.getElementById('department');
        const emptyState = document.getElementById('emptyState');
        
        if (departmentSelect && emptyState && emptyState.style.display !== 'none') {
            // If empty state is showing, auto-select first department on page load
            setTimeout(() => {
                if (departmentSelect.value === '' && departmentSelect.options.length > 1) {
                    // Don't auto-select, but add a visual indicator
                    departmentSelect.style.border = '2px solid #3b82f6';
                    departmentSelect.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    
                    // Add pulsing animation to draw attention
                    departmentSelect.style.animation = 'pulse 2s infinite';
                    
                    // Remove animation after first selection
                    departmentSelect.addEventListener('change', function removeAnimation() {
                        departmentSelect.style.animation = '';
                        departmentSelect.style.border = '';
                        departmentSelect.style.boxShadow = '';
                        departmentSelect.removeEventListener('change', removeAnimation);
                    });
                }
            }, 500);
        }
        
        // Add CSS for pulse animation if not exists
        if (!document.getElementById('pulseAnimation')) {
            const style = document.createElement('style');
            style.id = 'pulseAnimation';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Original filter code for when documents are loaded
        const explorerControls = document.querySelector('.explorer-controls');
        if (explorerControls && !document.getElementById('departmentFilter')) {
            const filterHTML = `
                <div class="department-filter" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: auto;
                ">
                    <label style="font-size: 12px; color: #64748b;">Filter by Type:</label>
                    <select id="departmentFilter" style="
                        padding: 6px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 12px;
                        background: white;
                        cursor: pointer;
                    ">
                        <option value="">All Types</option>
                        <option value="Policy">Policies</option>
                        <option value="Procedure">Procedures</option>
                        <option value="Form">Forms</option>
                        <option value="Template">Templates</option>
                        <option value="General">General</option>
                    </select>
                </div>
            `;
            explorerControls.insertAdjacentHTML('beforeend', filterHTML);
            
            // Add event listener for type filtering
            document.getElementById('departmentFilter').addEventListener('change', (e) => {
                this.filterByDocumentType(e.target.value);
            });
        }
    }

    /**
     * Filter documents by document type (not department)
     */
    filterByDocumentType(documentType) {
        const folderCards = document.querySelectorAll('.folder-card');
        folderCards.forEach(card => {
            const folderName = card.querySelector('.folder-name')?.textContent;
            if (!documentType || folderName === documentType) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Update document count based on visible folders
        let visibleCount = 0;
        document.querySelectorAll('.folder-card:not([style*="display: none"]) .document-item').forEach(() => {
            visibleCount++;
        });
        
        const documentCount = document.getElementById('documentCount');
        if (documentCount) {
            documentCount.textContent = `${visibleCount} documents${documentType ? ` of type ${documentType}` : ''}`;
        }
    }
    
    /**
     * Helper to trigger department loading
     */
    loadDepartmentDocuments(department) {
        const departmentSelect = document.getElementById('department');
        if (departmentSelect && department) {
            departmentSelect.value = department;
            // Trigger change event to load documents
            const event = new Event('change', { bubbles: true });
            departmentSelect.dispatchEvent(event);
        }
    }
}

// Initialize enhancements when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.documentEnhancements = new DocumentEnhancements();
        // Don't load from localStorage - departments come from blob storage
        window.documentEnhancements.addDepartmentFilter();
    });
} else {
    window.documentEnhancements = new DocumentEnhancements();
    // Don't load from localStorage - departments come from blob storage
    window.documentEnhancements.addDepartmentFilter();
}

// Export for use in other modules
window.DocumentEnhancements = DocumentEnhancements;
