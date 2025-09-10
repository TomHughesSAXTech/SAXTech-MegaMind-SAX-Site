/**
 * Document Preview Module
 * Handles document preview functionality with modal viewer
 */

class DocumentPreview {
    constructor() {
        this.modal = null;
        this.currentDocument = null;
        this.init();
    }

    init() {
        // Create modal HTML structure
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        const modalHTML = `
            <div id="documentPreviewModal" class="document-preview-modal" style="display: none;">
                <div class="modal-overlay"></div>
                <div class="modal-container">
                    <div class="modal-header">
                        <div class="modal-title">
                            <span class="doc-icon">📄</span>
                            <span id="previewDocTitle">Document Preview</span>
                        </div>
                        <div class="modal-actions">
                            <button class="btn-icon" id="downloadPreviewDoc" title="Download">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                            <button class="btn-icon" id="fullscreenPreview" title="Fullscreen">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                                </svg>
                            </button>
                            <button class="btn-icon btn-close" id="closePreviewModal" title="Close">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div id="previewLoading" class="preview-loading">
                            <div class="spinner"></div>
                            <p>Loading document...</p>
                        </div>
                        <div id="previewContent" class="preview-content" style="display: none;">
                            <!-- Content will be dynamically loaded here -->
                        </div>
                        <div id="previewError" class="preview-error" style="display: none;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <p>Unable to preview this document</p>
                            <button class="btn-secondary" id="downloadInstead">Download Instead</button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="document-info">
                            <span id="docType" class="info-badge">PDF</span>
                            <span id="docSize" class="info-badge">2.3 MB</span>
                            <span id="docPages" class="info-badge">12 pages</span>
                            <span id="docModified" class="info-badge">Modified: Today</span>
                        </div>
                        <div class="preview-controls" id="pdfControls" style="display: none;">
                            <button class="btn-icon" id="prevPage" title="Previous Page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <span class="page-info">
                                <input type="number" id="currentPage" value="1" min="1" class="page-input">
                                <span> / </span>
                                <span id="totalPages">1</span>
                            </span>
                            <button class="btn-icon" id="nextPage" title="Next Page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                            <div class="zoom-controls">
                                <button class="btn-icon" id="zoomOut" title="Zoom Out">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="8" y1="11" x2="14" y2="11"></line>
                                    </svg>
                                </button>
                                <span id="zoomLevel">100%</span>
                                <button class="btn-icon" id="zoomIn" title="Zoom In">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="11" y1="8" x2="11" y2="14"></line>
                                        <line x1="8" y1="11" x2="14" y2="11"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .document-preview-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                }

                .modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                }

                .modal-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 1200px;
                    height: 90vh;
                    background: white;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: modalSlideIn 0.3s ease-out;
                }

                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -48%);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 12px 12px 0 0;
                }

                .modal-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                }

                .doc-icon {
                    font-size: 20px;
                }

                .modal-actions {
                    display: flex;
                    gap: 8px;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border: 1px solid #e5e7eb;
                    background: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #6b7280;
                }

                .btn-icon:hover {
                    background: #f3f4f6;
                    color: #374151;
                    border-color: #d1d5db;
                }

                .btn-close {
                    color: #ef4444;
                }

                .btn-close:hover {
                    background: #fee2e2;
                    border-color: #fca5a5;
                }

                .modal-body {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                    background: #fafafa;
                }

                .preview-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #6b7280;
                }

                .spinner {
                    width: 48px;
                    height: 48px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .preview-content {
                    height: 100%;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }

                .preview-content iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .preview-content canvas {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .preview-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #ef4444;
                    gap: 16px;
                }

                .btn-secondary {
                    padding: 8px 16px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }

                .btn-secondary:hover {
                    background: #2563eb;
                }

                .modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 0 0 12px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .document-info {
                    display: flex;
                    gap: 12px;
                }

                .info-badge {
                    padding: 4px 8px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #6b7280;
                }

                .preview-controls {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .page-info {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 14px;
                    color: #374151;
                }

                .page-input {
                    width: 48px;
                    padding: 4px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    text-align: center;
                    font-size: 14px;
                }

                .zoom-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-left: 16px;
                    border-left: 1px solid #e5e7eb;
                }

                #zoomLevel {
                    min-width: 48px;
                    text-align: center;
                    font-size: 13px;
                    color: #374151;
                }

                .modal-container.fullscreen {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    border-radius: 0;
                }

                .modal-container.fullscreen .modal-header,
                .modal-container.fullscreen .modal-footer {
                    border-radius: 0;
                }
            </style>
        `;

        // Append to document
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        this.modal = document.getElementById('documentPreviewModal');
    }

    attachEventListeners() {
        // Close modal
        document.getElementById('closePreviewModal').addEventListener('click', () => this.close());
        document.querySelector('.modal-overlay').addEventListener('click', () => this.close());
        
        // Download
        document.getElementById('downloadPreviewDoc').addEventListener('click', () => this.download());
        document.getElementById('downloadInstead').addEventListener('click', () => this.download());
        
        // Fullscreen
        document.getElementById('fullscreenPreview').addEventListener('click', () => this.toggleFullscreen());
        
        // PDF controls
        document.getElementById('prevPage').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        document.getElementById('currentPage').addEventListener('change', (e) => this.goToPage(e.target.value));
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'none') return;
            
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.previousPage();
            if (e.key === 'ArrowRight') this.nextPage();
        });
    }

    async open(documentId, documentTitle, documentType, documentSize) {
        this.currentDocument = {
            id: documentId,
            title: documentTitle,
            type: documentType,
            size: documentSize
        };

        // Show modal
        this.modal.style.display = 'block';
        
        // Update header
        document.getElementById('previewDocTitle').textContent = documentTitle;
        document.getElementById('docType').textContent = documentType.toUpperCase();
        document.getElementById('docSize').textContent = this.formatFileSize(documentSize);
        
        // Show loading
        this.showLoading();
        
        try {
            // Fetch document preview
            await this.loadDocument(documentId, documentType);
        } catch (error) {
            console.error('Preview error:', error);
            this.showError();
        }
    }

    async loadDocument(documentId, documentType) {
        const previewUrl = `${window.API_CONFIG.baseUrl}/documents/preview?id=${documentId}`;
        
        if (documentType === 'pdf') {
            // For PDFs, use PDF.js or iframe
            this.loadPDF(previewUrl);
        } else if (['doc', 'docx', 'xls', 'xlsx'].includes(documentType)) {
            // For Office documents, use Office Online viewer
            this.loadOfficeDocument(previewUrl);
        } else if (['txt', 'json', 'xml', 'csv'].includes(documentType)) {
            // For text files, load content directly
            this.loadTextDocument(previewUrl);
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(documentType)) {
            // For images
            this.loadImage(previewUrl);
        } else {
            // Unsupported format
            this.showError();
        }
    }

    loadPDF(url) {
        const content = document.getElementById('previewContent');
        content.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%;"></iframe>`;
        
        this.showContent();
        document.getElementById('pdfControls').style.display = 'flex';
    }

    loadOfficeDocument(url) {
        const content = document.getElementById('previewContent');
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
        content.innerHTML = `<iframe src="${officeUrl}" style="width: 100%; height: 100%;"></iframe>`;
        
        this.showContent();
    }

    async loadTextDocument(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            const content = document.getElementById('previewContent');
            content.innerHTML = `
                <pre style="
                    width: 100%;
                    height: 100%;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    overflow: auto;
                    font-family: 'Monaco', 'Menlo', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #374151;
                ">${this.escapeHtml(text)}</pre>
            `;
            
            this.showContent();
        } catch (error) {
            this.showError();
        }
    }

    loadImage(url) {
        const content = document.getElementById('previewContent');
        content.innerHTML = `<img src="${url}" style="max-width: 100%; height: auto;">`;
        
        this.showContent();
    }

    showLoading() {
        document.getElementById('previewLoading').style.display = 'flex';
        document.getElementById('previewContent').style.display = 'none';
        document.getElementById('previewError').style.display = 'none';
    }

    showContent() {
        document.getElementById('previewLoading').style.display = 'none';
        document.getElementById('previewContent').style.display = 'flex';
        document.getElementById('previewError').style.display = 'none';
    }

    showError() {
        document.getElementById('previewLoading').style.display = 'none';
        document.getElementById('previewContent').style.display = 'none';
        document.getElementById('previewError').style.display = 'flex';
    }

    close() {
        this.modal.style.display = 'none';
        this.currentDocument = null;
        document.getElementById('pdfControls').style.display = 'none';
    }

    download() {
        if (!this.currentDocument) return;
        
        const downloadUrl = `${window.API_CONFIG.baseUrl}/documents/download?id=${this.currentDocument.id}`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = this.currentDocument.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    toggleFullscreen() {
        const container = document.querySelector('.modal-container');
        container.classList.toggle('fullscreen');
    }

    previousPage() {
        // Implement PDF page navigation
        const currentPage = parseInt(document.getElementById('currentPage').value);
        if (currentPage > 1) {
            this.goToPage(currentPage - 1);
        }
    }

    nextPage() {
        // Implement PDF page navigation
        const currentPage = parseInt(document.getElementById('currentPage').value);
        const totalPages = parseInt(document.getElementById('totalPages').textContent);
        if (currentPage < totalPages) {
            this.goToPage(currentPage + 1);
        }
    }

    goToPage(pageNumber) {
        // Implement PDF page navigation
        document.getElementById('currentPage').value = pageNumber;
        // Update PDF viewer to show specific page
    }

    zoom(factor) {
        // Implement zoom functionality
        const currentZoom = parseInt(document.getElementById('zoomLevel').textContent);
        const newZoom = Math.round(currentZoom * factor);
        document.getElementById('zoomLevel').textContent = `${newZoom}%`;
        // Update content zoom
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.documentPreview = new DocumentPreview();
    });
} else {
    window.documentPreview = new DocumentPreview();
}

// Export for use in other modules
window.DocumentPreview = DocumentPreview;
