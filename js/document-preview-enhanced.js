/**
 * Enhanced Document Preview System
 * Handles folder paths and provides draggable, styled modal
 */

// Make openDocumentPreview globally available
window.openDocumentPreview = async function(fileName, department) {
    console.log('Opening document preview for:', fileName, 'Department:', department);
    
    // Check if fileName is actually a URL (for indexed web pages)
    const isUrl = fileName.startsWith('http://') || fileName.startsWith('https://') || 
                  fileName.includes('.com') || fileName.includes('.org') || 
                  fileName.includes('.net') || fileName.includes('.gov');
    
    // Check if this is indexed website content
    const fileNameLower = fileName.toLowerCase();
    // Pattern for indexed content: saxXX_pNN_cN.txt or saxXX_content_*.txt or similar
    const isIndexedContent = (
        // Pattern 1: saxXX_pNN_cN.txt (e.g., saxwa_p33_c1.txt)
        /^sax[a-z]{2,}_p\d+_c\d+\.txt$/i.test(fileName) ||
        // Pattern 2: contains _content_ or content with .txt extension
        ((fileNameLower.includes('_content_') || fileNameLower.includes('content')) && 
         fileNameLower.endsWith('.txt')) ||
        // Pattern 3: starts with sax and contains page/chunk indicators
        (fileNameLower.startsWith('sax') && 
         (fileNameLower.includes('_p') || fileNameLower.includes('_c') || 
          fileNameLower.includes('page') || fileNameLower.includes('chunk')) &&
         fileNameLower.endsWith('.txt'))
    ) && (fileNameLower.includes('saxadvisorygroup') || fileNameLower.includes('saxtechnology') || 
          fileNameLower.includes('saxca') || fileNameLower.includes('saxga') || 
          fileNameLower.includes('saxfla') || fileNameLower.includes('saxor') || 
          fileNameLower.includes('saxsc') || fileNameLower.includes('saxwa') ||
          fileNameLower.startsWith('sax'));
    
    if (isUrl) {
        // If it's a URL, open it in a new tab
        console.log('Opening URL in new tab:', fileName);
        let url = fileName;
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        window.open(url, '_blank');
        return;
    }
    
    if (isIndexedContent) {
        // This is indexed website content, try to get the actual page URL from the search index
        console.log('Detected indexed website content:', fileName);
        
        try {
            // Try to get the actual source URL from the search API
            // Use a broader search to ensure we get results
            const searchResponse = await fetch('https://saxtechmegamindfunctions.azurewebsites.net/api/documents/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw=='
                },
                body: JSON.stringify({
                    query: fileName.replace('.txt', ''),  // Remove .txt extension for better matching
                    filter: `fileName eq '${fileName}'`,
                    top: 10,
                    searchMode: 'all',
                    select: '*',  // Get all fields to see what's available
                    includeTotalCount: true
                })
            });
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                console.log('Search response data:', {
                    totalCount: searchData['@odata.count'],
                    resultCount: searchData.value?.length || 0
                });
                
                const results = searchData.value || [];
                
                // Log all results to see what we're getting
                console.log('Search results:', results.map(r => ({
                    fileName: r.fileName,
                    pageURL: r.pageURL,
                    pageUrl: r.pageUrl,
                    hasContent: !!r.content
                })));
                
                // Find the exact document
                const matchingDoc = results.find(doc => 
                    doc.fileName === fileName
                );
                
                if (matchingDoc) {
                    console.log('Found matching document with fields:', Object.keys(matchingDoc));
                    console.log('Document data:', JSON.stringify(matchingDoc, null, 2));
                    
                    // Log specific URL fields for debugging
                    console.log('URL field values:', {
                        pageURL: matchingDoc.pageURL,
                        pageUrl: matchingDoc.pageUrl,
                        sourceUrl: matchingDoc.sourceUrl,
                        url: matchingDoc.url,
                        websiteUrl: matchingDoc.websiteUrl
                    });
                    
                    // Try to get the actual page URL from various possible fields
                    // Priority: pageURL (case-sensitive) > pageUrl > sourceUrl > url > websiteUrl
                    let pageUrl = matchingDoc.pageURL || matchingDoc.pageUrl || 
                                 matchingDoc.sourceUrl || matchingDoc.url || 
                                 matchingDoc.websiteUrl;
                    
                    console.log('Selected pageUrl:', pageUrl);
                    
                    // Check title field for URLs (often contains the page title and URL)
                    if (!pageUrl && matchingDoc.title) {
                        const titleUrlMatch = matchingDoc.title.match(/(https?:\/\/[^\s]+)/i);
                        if (titleUrlMatch) {
                            pageUrl = titleUrlMatch[1];
                            console.log('Found URL in title:', pageUrl);
                        }
                    }
                    
                    // Check metadata for URL
                    if (!pageUrl && matchingDoc.metadata) {
                        try {
                            const metadata = typeof matchingDoc.metadata === 'string' ? 
                                           JSON.parse(matchingDoc.metadata) : matchingDoc.metadata;
                            pageUrl = metadata.pageURL || metadata.pageUrl || metadata.sourceUrl || 
                                     metadata.url || metadata.websiteUrl || 
                                     metadata.source_url || metadata.page_url;
                            
                            if (!pageUrl && metadata.title) {
                                const metaTitleUrlMatch = metadata.title.match(/(https?:\/\/[^\s]+)/i);
                                if (metaTitleUrlMatch) {
                                    pageUrl = metaTitleUrlMatch[1];
                                    console.log('Found URL in metadata title:', pageUrl);
                                }
                            }
                        } catch (e) {
                            console.log('Could not parse metadata:', e);
                        }
                    }
                    
                    // If no URL found in standard fields, check all fields for URL patterns
                    if (!pageUrl) {
                        console.log('No URL in standard fields, checking all fields...');
                        for (const [key, value] of Object.entries(matchingDoc)) {
                            if (typeof value === 'string' && value.includes('http')) {
                                console.log(`Found potential URL in field '${key}':`, value);
                                if (value.startsWith('http://') || value.startsWith('https://')) {
                                    pageUrl = value;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (pageUrl && (pageUrl.startsWith('http://') || pageUrl.startsWith('https://'))) {
                        console.log('Opening specific page URL:', pageUrl);
                        window.open(pageUrl, '_blank');
                        showIndexedContentMessage(fileName, pageUrl, true);
                        return;
                    }
                    
                    // If we have content, try to extract URL from it
                    if (matchingDoc.content) {
                        // Try to find URLs in the content
                        // First check for labeled URLs
                        const labeledUrlMatch = matchingDoc.content.match(
                            /(?:Source:|URL:|From:|Website:|Link:|Page:|Location:)\s*(https?:\/\/[^\s]+)/i
                        );
                        
                        if (labeledUrlMatch) {
                            const foundUrl = labeledUrlMatch[1];
                            console.log('Found labeled URL in content:', foundUrl);
                            window.open(foundUrl, '_blank');
                            showIndexedContentMessage(fileName, foundUrl, true);
                            return;
                        }
                        
                        // Try to find any URL in the content that looks like the SAX websites
                        const saxUrlMatch = matchingDoc.content.match(
                            /(https?:\/\/(?:www\.)?sax(?:technology|advisorygroup|ca|ga|fla|or|sc|wa)\.com[^\s]*)/i
                        );
                        
                        if (saxUrlMatch) {
                            const foundUrl = saxUrlMatch[1];
                            console.log('Found SAX website URL in content:', foundUrl);
                            window.open(foundUrl, '_blank');
                            showIndexedContentMessage(fileName, foundUrl, true);
                            return;
                        }
                        
                        // Try to find any URL in the content
                        const anyUrlMatch = matchingDoc.content.match(/(https?:\/\/[^\s]+)/i);
                        
                        if (anyUrlMatch) {
                            const foundUrl = anyUrlMatch[1];
                            console.log('Found URL in content:', foundUrl);
                            window.open(foundUrl, '_blank');
                            showIndexedContentMessage(fileName, foundUrl, true);
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching source URL:', error);
        }
        
        // Fallback to main website if we can't find specific page
        let websiteUrl = '';
        
        if (fileName.includes('saxadvisorygroup')) {
            websiteUrl = 'https://www.saxadvisorygroup.com';
        } else if (fileName.includes('saxtechnology')) {
            websiteUrl = 'https://www.saxtechnology.com';
        } else if (fileName.includes('saxca')) {
            websiteUrl = 'https://www.saxca.com';
        } else if (fileName.includes('saxga')) {
            websiteUrl = 'https://www.saxga.com';
        } else if (fileName.includes('saxfla')) {
            websiteUrl = 'https://www.saxfla.com';
        } else if (fileName.includes('saxor')) {
            websiteUrl = 'https://www.saxor.com';
        } else if (fileName.includes('saxsc')) {
            websiteUrl = 'https://www.saxsc.com';
        } else if (fileName.includes('saxwa')) {
            websiteUrl = 'https://www.saxwa.com';
        }
        
        if (websiteUrl) {
            console.log('Opening main website (specific page not found):', websiteUrl);
            window.open(websiteUrl, '_blank');
            showIndexedContentMessage(fileName, websiteUrl, false);
            return;
        }
    }
    
    // Show loading modal for file documents
    showPreviewLoading(fileName);
    
    try {
        // If no department provided, fetch it from the API
        let actualDepartment = department;
        
        if (!actualDepartment || actualDepartment === '' || actualDepartment === 'undefined') {
            console.log('No department provided, fetching from API...');
            
            // Try to find the document in the search index to get its department
            const searchResponse = await fetch('https://saxtechmegamindfunctions.azurewebsites.net/api/documents/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw=='
                },
                body: JSON.stringify({
                    query: fileName,
                    top: 10,
                    searchMode: 'all'
                })
            });
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                const results = searchData.value || [];
                
                // Find the document that matches our filename
                const matchingDoc = results.find(doc => 
                    doc.fileName === fileName || 
                    (doc.fileName && doc.fileName.replace(/_chunk_\d+$/, '') === fileName)
                );
                
                if (matchingDoc && matchingDoc.department) {
                    actualDepartment = matchingDoc.department;
                    console.log('Found department from API:', actualDepartment);
                }
            }
        }
        
        // If still no department, try default folders
        if (!actualDepartment || actualDepartment === '' || actualDepartment === 'undefined') {
            console.log('Could not determine department, trying common paths...');
            // Try common paths
            const commonPaths = ['SAXCA', 'SAXGA', 'SAXFLA', 'SAXOR', 'SAXSC', 'SAXWA', 'General'];
            for (const path of commonPaths) {
                const testUrl = await generateSASUrl(`${path}/${fileName}`);
                if (testUrl) {
                    actualDepartment = path;
                    console.log('Found document in:', path);
                    break;
                }
            }
        }
        
        // If still no department, throw error
        if (!actualDepartment || actualDepartment === '' || actualDepartment === 'undefined') {
            throw new Error('Could not determine document location');
        }
        
        // Use the department to build the path
        const documentPath = `${actualDepartment}/${fileName}`;
        console.log('Trying path:', documentPath);
        
        const sasUrl = await generateSASUrl(documentPath);
        
        if (!sasUrl) {
            // Before throwing error, check if this might be indexed content we missed
            if (fileName.includes('_content_') || fileName.includes('saxadvisorygroup') || 
                fileName.includes('saxtechnology') || fileName.includes('sax')) {
                // This might be indexed content, try to open the website
                console.log('Document not found in blob storage, checking if it\'s indexed content...');
                
                let websiteUrl = '';
                if (fileName.toLowerCase().includes('saxadvisorygroup')) {
                    websiteUrl = 'https://www.saxadvisorygroup.com';
                } else if (fileName.toLowerCase().includes('saxtechnology')) {
                    websiteUrl = 'https://www.saxtechnology.com';
                } else if (fileName.toLowerCase().includes('saxca')) {
                    websiteUrl = 'https://www.saxca.com';
                } else if (fileName.toLowerCase().includes('saxga')) {
                    websiteUrl = 'https://www.saxga.com';
                } else if (fileName.toLowerCase().includes('saxfla')) {
                    websiteUrl = 'https://www.saxfla.com';
                } else if (fileName.toLowerCase().includes('saxor')) {
                    websiteUrl = 'https://www.saxor.com';
                } else if (fileName.toLowerCase().includes('saxsc')) {
                    websiteUrl = 'https://www.saxsc.com';
                } else if (fileName.toLowerCase().includes('saxwa')) {
                    websiteUrl = 'https://www.saxwa.com';
                }
                
                if (websiteUrl) {
                    console.log('Opening website for indexed content:', websiteUrl);
                    // Close any loading modal
                    const modal = document.getElementById('documentPreviewModal');
                    if (modal) {
                        modal.classList.remove('show');
                    }
                    window.open(websiteUrl, '_blank');
                    showIndexedContentMessage(fileName, websiteUrl, false);
                    return;
                }
            }
            
            throw new Error(`Document not found in ${actualDepartment} folder`);
        }
        
        console.log('Displaying document with SAS URL');
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
    // Ensure display is not overridden by inline style
    modal.style.display = '';
}

function displayDocumentPreview(fileName, sasUrl) {
    console.log('displayDocumentPreview called with:', fileName, sasUrl);
    let modal = document.getElementById('documentPreviewModal');
    
    if (!modal) {
        console.log('Creating new modal');
        modal = createPreviewModal();
    }
    
    const fileExt = fileName.split('.').pop().toLowerCase();
    let previewContent = '';
    
    // Determine display method by file type
    if (fileExt === 'pdf') {
        previewContent = `<iframe src="${sasUrl}" style="width: 100%; height: 100%; border: none; display: block;"></iframe>`;
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
    
    console.log('Adding show class to modal');
    modal.classList.add('show');
    // Ensure display is not overridden by inline style
    modal.style.display = '';
    console.log('Modal display complete, modal element:', modal);
}

function showIndexedContentMessage(fileName, url, isSpecificPage) {
    // Create a temporary notification instead of modal
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">🌐</span>
            <div>
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${isSpecificPage ? 'Opening Source Page' : 'Opening Website'}
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${fileName}
                </div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                    ${url}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
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
    // Ensure display is not overridden by inline style
    modal.style.display = '';
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
                display: block !important;
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
                width: 85%;
                max-width: 1100px;
                height: 85vh;
                background: white;
                border: 2px solid rgba(255, 215, 0, 0.3);
                border-radius: 12px;
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
                padding: 12px 20px;
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                border-bottom: 2px solid rgba(255, 215, 0, 0.3);
                cursor: move;
                flex-shrink: 0;
                height: 50px;
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
                overflow: hidden;
                background: white;
                position: relative;
                height: calc(100% - 50px);
                display: flex;
                flex-direction: column;
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