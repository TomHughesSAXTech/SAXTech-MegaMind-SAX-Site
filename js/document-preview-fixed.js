/**
 * Document Preview with SAS Token Generation
 * Fixes the public access issue by using SAS tokens from Azure Function
 */

// Make openDocumentPreview globally available for onclick handlers
window.openDocumentPreview = async function(fileName) {
    console.log('Opening document preview for:', fileName);
    
    // Show loading modal while generating SAS token
    showPreviewLoading(fileName);
    
    try {
        // Generate SAS token from Azure Function
        const sasResponse = await fetch('https://saxtechmegamindfunctions.azurewebsites.net/api/GenerateSASToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName,
                containerName: 'documents',
                permissions: 'r',
                expiryHours: 1
            })
        });

        if (!sasResponse.ok) {
            throw new Error('Failed to generate SAS token');
        }

        const sasData = await sasResponse.json();
        const sasUrl = sasData.sasUrl || sasData.url;
        
        if (!sasUrl) {
            throw new Error('No SAS URL returned');
        }

        console.log('SAS URL generated successfully');
        
        // Display the document in the modal
        displayDocumentPreview(fileName, sasUrl);
        
    } catch (error) {
        console.error('Error opening document preview:', error);
        showPreviewError(fileName, error.message);
    }
};

function showPreviewLoading(fileName) {
    // Create or update modal
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    // Update modal content
    const modalContent = modal.querySelector('.modal-content') || modal;
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>Loading Document: ${fileName}</h3>
            <button class="close-btn" onclick="closeDocumentPreview()">×</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p>Generating secure preview link...</p>
        </div>
    `;
    
    modal.style.display = 'block';
}

function displayDocumentPreview(fileName, sasUrl) {
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const fileExt = fileName.split('.').pop().toLowerCase();
    let previewContent = '';
    
    // Determine how to display based on file type
    if (fileExt === 'pdf') {
        // PDF - use iframe
        previewContent = `<iframe src="${sasUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(fileExt)) {
        // Images - use img tag
        previewContent = `
            <div style="text-align: center; padding: 20px; height: 100%; overflow: auto;">
                <img src="${sasUrl}" style="max-width: 100%; height: auto;" alt="${fileName}">
            </div>
        `;
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt)) {
        // Office documents - use Office Online viewer
        const encodedUrl = encodeURIComponent(sasUrl);
        previewContent = `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (['txt', 'log', 'json', 'xml', 'csv', 'md'].includes(fileExt)) {
        // Text files - fetch and display
        fetch(sasUrl)
            .then(response => response.text())
            .then(text => {
                const previewArea = document.getElementById('documentPreviewArea');
                if (previewArea) {
                    previewArea.innerHTML = `
                        <pre style="padding: 20px; background: #f5f5f5; border-radius: 4px; overflow: auto; height: 100%; margin: 0; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5;">
${escapeHtml(text)}
                        </pre>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading text file:', error);
                showPreviewError(fileName, 'Failed to load text content');
            });
        
        // Show loading for text files
        previewContent = `
            <div id="documentPreviewArea" style="height: 100%; overflow: auto;">
                <div style="text-align: center; padding: 40px;">
                    <div class="spinner"></div>
                    <p>Loading text content...</p>
                </div>
            </div>
        `;
    } else {
        // Other files - provide download link
        previewContent = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3>${fileName}</h3>
                <p style="color: #666; margin: 20px 0;">Preview not available for this file type (.${fileExt})</p>
                <a href="${sasUrl}" download="${fileName}" class="download-btn" style="
                    display: inline-block;
                    padding: 10px 20px;
                    background: #2196F3;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin-top: 20px;
                ">Download File</a>
            </div>
        `;
    }
    
    // Update modal content
    const modalContent = modal.querySelector('.modal-content') || modal;
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>📄 ${fileName}</h3>
            <div class="modal-actions">
                <a href="${sasUrl}" download="${fileName}" class="action-btn" title="Download">
                    ⬇️ Download
                </a>
                <button class="close-btn" onclick="closeDocumentPreview()">×</button>
            </div>
        </div>
        <div class="modal-body" style="height: calc(100% - 60px); overflow: hidden;">
            ${previewContent}
        </div>
    `;
    
    modal.style.display = 'block';
}

function showPreviewError(fileName, errorMessage) {
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const modalContent = modal.querySelector('.modal-content') || modal;
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>Preview Error</h3>
            <button class="close-btn" onclick="closeDocumentPreview()">×</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 20px; color: #f44336;">⚠️</div>
            <h3>${fileName}</h3>
            <p style="color: #666; margin: 20px 0;">Unable to preview this document</p>
            <p style="color: #999; font-size: 14px;">${errorMessage}</p>
            <button onclick="closeDocumentPreview()" style="
                padding: 10px 20px;
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 20px;
            ">Close</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

function createPreviewModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('documentPreviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal structure
    const modal = document.createElement('div');
    modal.id = 'documentPreviewModal';
    modal.className = 'document-preview-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeDocumentPreview()"></div>
        <div class="modal-content">
            <!-- Content will be inserted here -->
        </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('documentPreviewStyles')) {
        const styles = document.createElement('style');
        styles.id = 'documentPreviewStyles';
        styles.innerHTML = `
            .document-preview-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
            }
            
            .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 1200px;
                height: 85vh;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #f5f5f5;
                border-bottom: 1px solid #ddd;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
                color: #333;
            }
            
            .modal-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .action-btn {
                padding: 5px 10px;
                background: #4CAF50;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            
            .close-btn:hover {
                color: #000;
            }
            
            .modal-body {
                padding: 0;
                height: calc(100% - 60px);
                overflow: auto;
                background: white;
            }
            
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2196F3;
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
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
    return modal;
}

window.closeDocumentPreview = function() {
    const modal = document.getElementById('documentPreviewModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document preview system initialized');
});