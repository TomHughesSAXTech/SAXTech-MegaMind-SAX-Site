/**
 * Enhanced Document Preview System
 * Handles folder paths and provides draggable, styled modal
 */

// Make openDocumentPreview globally available
window.openDocumentPreview = async function(fileName) {
    console.log('Opening document preview for:', fileName);
    
    // The actual blob path might include folders
    // For "2025.07_Caseware Manual.pdf" the actual path is "Audit and Attestation/2025.07_Caseware Manual.pdf"
    
    // Show loading modal
    showPreviewLoading(fileName);
    
    try {
        // Try with original filename first
        let sasUrl = await generateSASUrl(fileName);
        
        if (!sasUrl) {
            // If that fails, try common folder patterns
            const possiblePaths = [
                fileName,
                `Audit and Attestation/${fileName}`,
                `Technical Procedures/${fileName}`,
                `Documents/${fileName}`,
                `General/${fileName}`
            ];
            
            for (const path of possiblePaths) {
                console.log('Trying path:', path);
                sasUrl = await generateSASUrl(path);
                if (sasUrl) break;
            }
        }
        
        if (!sasUrl) {
            throw new Error('Document not found in any expected location');
        }
        
        // Display the document
        displayDocumentPreview(fileName, sasUrl);
        
    } catch (error) {
        console.error('Error opening document preview:', error);
        showPreviewError(fileName, error.message);
    }
};

async function generateSASUrl(blobPath) {
    try {
        const response = await fetch('https://saxtechmegamindfunctions.azurewebsites.net/api/GenerateSASToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: blobPath,
                containerName: 'saxdocuments',
                permissions: 'r',
                expiryHours: 1
            })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.blobUrl || data.sasUrl || data.url;
    } catch (error) {
        console.error('SAS generation error for path:', blobPath, error);
        return null;
    }
}

function showPreviewLoading(fileName) {
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-title">
                <span class="doc-icon">📄</span>
                <h3>Loading: ${fileName}</h3>
            </div>
            <button class="modal-close" onclick="closeDocumentPreview()">×</button>
        </div>
        <div class="modal-body loading">
            <div class="spinner"></div>
            <p>Generating secure preview...</p>
        </div>
    `;
    
    modal.classList.add('show');
}

function displayDocumentPreview(fileName, sasUrl) {
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const fileExt = fileName.split('.').pop().toLowerCase();
    let previewContent = '';
    
    // Determine display method by file type
    if (fileExt === 'pdf') {
        previewContent = `<iframe src="${sasUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(fileExt)) {
        previewContent = `
            <div class="image-preview">
                <img src="${sasUrl}" alt="${fileName}">
            </div>
        `;
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt)) {
        const encodedUrl = encodeURIComponent(sasUrl);
        previewContent = `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (['txt', 'log', 'json', 'xml', 'csv', 'md'].includes(fileExt)) {
        fetch(sasUrl)
            .then(response => response.text())
            .then(text => {
                const previewArea = document.getElementById('documentPreviewArea');
                if (previewArea) {
                    previewArea.innerHTML = `<pre class="text-preview">${escapeHtml(text)}</pre>`;
                }
            })
            .catch(error => {
                console.error('Error loading text:', error);
                showPreviewError(fileName, 'Failed to load text content');
            });
        
        previewContent = `
            <div id="documentPreviewArea" class="text-preview-container">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading text content...</p>
                </div>
            </div>
        `;
    } else {
        previewContent = `
            <div class="unsupported-preview">
                <div class="file-icon">📄</div>
                <h3>${fileName}</h3>
                <p>Preview not available for .${fileExt} files</p>
                <a href="${sasUrl}" download="${fileName}" class="download-btn">
                    ⬇️ Download File
                </a>
            </div>
        `;
    }
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="modal-header" onmousedown="startDrag(event)">
            <div class="modal-title">
                <span class="doc-icon">📄</span>
                <h3>${fileName}</h3>
            </div>
            <div class="modal-actions">
                <a href="${sasUrl}" download="${fileName}" class="action-btn download" title="Download">
                    ⬇️
                </a>
                <button class="action-btn fullscreen" onclick="toggleFullscreen()" title="Fullscreen">
                    ⛶
                </button>
                <button class="modal-close" onclick="closeDocumentPreview()">×</button>
            </div>
        </div>
        <div class="modal-body">
            ${previewContent}
        </div>
    `;
    
    modal.classList.add('show');
}

function showPreviewError(fileName, errorMessage) {
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-title">
                <span class="doc-icon error">⚠️</span>
                <h3>Preview Error</h3>
            </div>
            <button class="modal-close" onclick="closeDocumentPreview()">×</button>
        </div>
        <div class="modal-body error">
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <h3>${fileName}</h3>
                <p>Unable to preview this document</p>
                <p class="error-detail">${errorMessage}</p>
                <button class="close-btn" onclick="closeDocumentPreview()">Close</button>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

function createPreviewModal() {
    const existingModal = document.getElementById('documentPreviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'documentPreviewModal';
    modal.className = 'document-preview-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeDocumentPreview()"></div>
        <div class="modal-content">
            <!-- Content will be inserted here -->
        </div>
    `;
    
    // Add styles
    if (!document.getElementById('documentPreviewStyles')) {
        const styles = document.createElement('style');
        styles.id = 'documentPreviewStyles';
        styles.innerHTML = `
            .document-preview-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }
            
            .document-preview-modal.show {
                display: block;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .modal-content {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 1000px;
                height: 75vh;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                border: 2px solid rgba(255, 215, 0, 0.3);
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
                           0 0 40px rgba(255, 215, 0, 0.2);
                display: flex;
                flex-direction: column;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -45%);
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
                padding: 15px 20px;
                background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%);
                border-bottom: 1px solid rgba(255, 215, 0, 0.2);
                cursor: move;
            }
            
            .modal-title {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .doc-icon {
                font-size: 24px;
                filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3));
            }
            
            .doc-icon.error {
                filter: drop-shadow(0 2px 4px rgba(255, 69, 0, 0.3));
            }
            
            .modal-title h3 {
                margin: 0;
                font-size: 18px;
                color: #FFD700;
                font-weight: 400;
                letter-spacing: 1px;
            }
            
            .modal-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .action-btn {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid rgba(255, 215, 0, 0.3);
                color: #FFD700;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            
            .action-btn:hover {
                background: rgba(255, 215, 0, 0.2);
                transform: scale(1.1);
                box-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
            }
            
            .modal-close {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(255, 69, 0, 0.1);
                border: 1px solid rgba(255, 69, 0, 0.3);
                color: #FF4500;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .modal-close:hover {
                background: rgba(255, 69, 0, 0.2);
                transform: rotate(90deg) scale(1.1);
            }
            
            .modal-body {
                flex: 1;
                overflow: auto;
                background: white;
                position: relative;
            }
            
            .modal-body.loading,
            .modal-body.error {
                display: flex;
                align-items: center;
                justify-content: center;
                background: #fafafa;
            }
            
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #FFD700;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .image-preview {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                height: 100%;
                background: #f5f5f5;
            }
            
            .image-preview img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .text-preview-container {
                height: 100%;
                overflow: auto;
            }
            
            .text-preview {
                padding: 20px;
                background: #f8f8f8;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.6;
                white-space: pre-wrap;
                word-wrap: break-word;
                margin: 0;
            }
            
            .unsupported-preview {
                text-align: center;
                padding: 60px 40px;
            }
            
            .file-icon {
                font-size: 72px;
                margin-bottom: 20px;
                opacity: 0.5;
            }
            
            .download-btn {
                display: inline-block;
                margin-top: 20px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #1a1a1a;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .download-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
            }
            
            .error-content {
                text-align: center;
                padding: 40px;
            }
            
            .error-icon {
                font-size: 64px;
                margin-bottom: 20px;
                color: #FF4500;
            }
            
            .error-detail {
                color: #666;
                font-size: 14px;
                margin-top: 10px;
            }
            
            .close-btn {
                margin-top: 20px;
                padding: 10px 20px;
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            }
            
            .close-btn:hover {
                background: #1976D2;
                transform: scale(1.05);
            }
            
            /* Fullscreen mode */
            .modal-content.fullscreen {
                width: 100%;
                max-width: 100%;
                height: 100vh;
                border-radius: 0;
                border: none;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
    return modal;
}

// Draggable functionality
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

window.startDrag = function(e) {
    const modal = document.querySelector('.modal-content');
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target.closest('.modal-header')) {
        isDragging = true;
        modal.style.transition = 'none';
    }
};

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        
        const modal = document.querySelector('.modal-content');
        modal.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        const modal = document.querySelector('.modal-content');
        modal.style.transition = '';
    }
});

window.toggleFullscreen = function() {
    const modal = document.querySelector('.modal-content');
    modal.classList.toggle('fullscreen');
    
    // Reset position when toggling fullscreen
    if (modal.classList.contains('fullscreen')) {
        xOffset = 0;
        yOffset = 0;
        modal.style.transform = 'translate(-50%, -50%)';
    }
};

window.closeDocumentPreview = function() {
    const modal = document.getElementById('documentPreviewModal');
    if (modal) {
        modal.classList.remove('show');
        // Reset drag position
        xOffset = 0;
        yOffset = 0;
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enhanced document preview system initialized');
});