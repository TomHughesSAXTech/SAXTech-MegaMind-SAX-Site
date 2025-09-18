// DOCUMENT PREVIEW FIX
// This fixes the document preview modal that isn't opening

// Global function to open document preview
window.openDocumentPreview = async function(fileName) {
    console.log('[Document Preview] Opening preview for:', fileName);
    
    // First, check if modal exists, if not create it
    let modal = document.getElementById('documentPreviewModal');
    if (!modal) {
        console.log('[Document Preview] Creating modal structure');
        
        // Create modal HTML
        const modalHTML = `
            <div id="documentPreviewModal" class="modal" style="
                display: none;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.8);
                align-items: center;
                justify-content: center;
            ">
                <div class="modal-content" style="
                    width: 90%;
                    height: 90%;
                    max-width: 1200px;
                    background: white;
                    border-radius: 12px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                ">
                    <div class="modal-header" style="
                        padding: 20px;
                        border-bottom: 1px solid #e0e0e0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h2 id="previewTitle" style="margin: 0; color: #333;">Document Preview</h2>
                        <span class="close" onclick="window.closeDocumentPreview()" style="
                            font-size: 32px;
                            font-weight: bold;
                            color: #aaa;
                            cursor: pointer;
                            line-height: 20px;
                        ">&times;</span>
                    </div>
                    <div class="modal-body" style="
                        flex: 1;
                        padding: 0;
                        overflow: hidden;
                    ">
                        <iframe id="previewFrame" style="
                            width: 100%;
                            height: 100%;
                            border: none;
                        "></iframe>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('documentPreviewModal');
        
        // Add event listeners
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                window.closeDocumentPreview();
            }
        });
        
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                window.closeDocumentPreview();
            }
        });
    }
    
    // Get modal elements
    const previewFrame = document.getElementById('previewFrame');
    const previewTitle = document.getElementById('previewTitle');
    
    // Show modal with flex display for centering
    modal.style.display = 'flex';
    previewTitle.textContent = `Loading ${fileName}...`;
    previewFrame.src = 'about:blank';
    
    try {
        // Generate SAS token using Azure Function
        console.log('[Document Preview] Generating SAS token...');
        const sasResponse = await fetch('https://saxtechmegamindfunctions.azurewebsites.net/api/GenerateSASToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': 'w6PUFV_kP4lcJVkK9p8AknKd1pwpIPQEK9gph6iz9kYJAzFuWfzgbg=='
            },
            body: JSON.stringify({
                fileName: fileName
            })
        });
        
        if (!sasResponse.ok) {
            throw new Error(`Failed to generate SAS token: ${sasResponse.status}`);
        }
        
        const sasData = await sasResponse.json();
        console.log('[Document Preview] SAS token generated successfully');
        
        // Create the preview URL with SAS token
        const documentUrl = sasData.url;
        
        // Update title
        previewTitle.textContent = fileName;
        
        // Determine file type and display accordingly
        const fileExtension = fileName.split('.').pop().toLowerCase();
        console.log('[Document Preview] File extension:', fileExtension);
        
        if (['pdf'].includes(fileExtension)) {
            // Direct display for PDFs
            previewFrame.src = documentUrl;
        } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
            // Use Office Online viewer for Office documents
            const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`;
            console.log('[Document Preview] Using Office Online viewer');
            previewFrame.src = viewerUrl;
        } else if (['txt', 'csv', 'json', 'xml', 'html', 'md'].includes(fileExtension)) {
            // For text files, fetch and display content
            console.log('[Document Preview] Fetching text content...');
            const textResponse = await fetch(documentUrl);
            const textContent = await textResponse.text();
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            font-family: monospace; 
                            padding: 20px; 
                            white-space: pre-wrap; 
                            word-wrap: break-word;
                            background: #f5f5f5;
                            color: #333;
                        }
                    </style>
                </head>
                <body>${escapeHtml(textContent)}</body>
                </html>
            `;
            previewFrame.srcdoc = htmlContent;
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(fileExtension)) {
            // For images
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh;
                            background: #f0f0f0;
                        }
                        img { 
                            max-width: 100%; 
                            max-height: 100vh; 
                            object-fit: contain;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        }
                    </style>
                </head>
                <body>
                    <img src="${documentUrl}" alt="${fileName}">
                </body>
                </html>
            `;
            previewFrame.srcdoc = htmlContent;
        } else {
            // Unsupported file type - show download option
            console.log('[Document Preview] Unsupported file type, showing download option');
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .container {
                            text-align: center;
                            padding: 40px;
                            background: white;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h2 { color: #333; }
                        p { color: #666; margin: 20px 0; }
                        a {
                            display: inline-block;
                            padding: 12px 24px;
                            background: #007bff;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            transition: background 0.3s;
                        }
                        a:hover { background: #0056b3; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>📄 ${fileName}</h2>
                        <p>This file type (.${fileExtension}) cannot be previewed directly.</p>
                        <a href="${documentUrl}" download="${fileName}">Download File</a>
                    </div>
                </body>
                </html>
            `;
            previewFrame.srcdoc = htmlContent;
        }
        
        console.log('[Document Preview] Preview loaded successfully');
        
    } catch (error) {
        console.error('[Document Preview] Error:', error);
        previewTitle.textContent = 'Error Loading Document';
        
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .error {
                        text-align: center;
                        padding: 40px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                    }
                    h2 { color: #d32f2f; }
                    p { color: #666; line-height: 1.5; }
                    .details {
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 5px;
                        margin-top: 15px;
                        font-family: monospace;
                        font-size: 12px;
                        color: #555;
                        text-align: left;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>⚠️ Error Loading Document</h2>
                    <p>Unable to load the document preview.</p>
                    <div class="details">${error.message}</div>
                    <p>Please try again or contact support if the issue persists.</p>
                </div>
            </body>
            </html>
        `;
        previewFrame.srcdoc = errorHtml;
    }
};

// Global function to close document preview
window.closeDocumentPreview = function() {
    console.log('[Document Preview] Closing preview');
    const modal = document.getElementById('documentPreviewModal');
    if (modal) {
        modal.style.display = 'none';
        const previewFrame = document.getElementById('previewFrame');
        if (previewFrame) {
            previewFrame.src = 'about:blank';
            previewFrame.srcdoc = '';
        }
    }
};

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[Document Preview] System initialized');
    });
} else {
    console.log('[Document Preview] System initialized');
}

// Expose to window for debugging
window.documentPreviewDebug = {
    testPreview: function(fileName) {
        window.openDocumentPreview(fileName || 'test-document.pdf');
    },
    checkModal: function() {
        const modal = document.getElementById('documentPreviewModal');
        console.log('Modal exists:', !!modal);
        if (modal) {
            console.log('Modal display:', modal.style.display);
        }
        return modal;
    }
};