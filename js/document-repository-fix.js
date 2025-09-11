// Document Repository JavaScript - Fixed Version
// This file contains all the fixes for the document repository functionality

// Key fixes applied:
// 1. Fixed loadDocuments() to use correct query structure (query, department, documentType instead of search, filter)
// 2. Fixed deleteDocument() to use the correct endpoint URL format
// 3. Fixed department filter to properly handle empty values for "All Departments"
// 4. Fixed response handling to support both value and results properties
// 5. Fixed blob path construction to match actual storage structure

// Replace the loadDocuments function (line 306-344)
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

// Replace the deleteDocument function (line 474-514)
async function deleteDocument(docId, fileName) {
    if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        // Use correct delete endpoint URL format
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
                
                // Reload documents
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

// Replace the handleDepartmentFilter function (line 560-563)
function handleDepartmentFilter() {
    const selectedValue = elements.departmentFilter.value;
    // Empty string for 'All Departments', otherwise use the selected value
    state.currentDepartment = selectedValue === '' ? '' : selectedValue;
    console.log('Department filter changed to:', state.currentDepartment || 'All Departments');
    loadDocuments();
}

// Fix for generateSASToken and constructBlobUrl to handle actual blob paths
// The actual blob structure is: {Department}/{optionalSubFolder}/{hash}_{fileName}
// Not: saxdocuments/original-documents/{department}/{fileName}

// Replace generateSASToken function (line 517-544)
async function generateSASToken(fileName, department) {
    try {
        // We need to find the actual blob path which includes the hash
        // First, try to get the document info from the state
        const doc = state.documents.find(d => 
            (d.fileName === fileName || d.title === fileName) && 
            d.department === department
        );
        
        let blobPath;
        if (doc && doc.blobUrl) {
            // Extract path from existing blob URL
            const url = new URL(doc.blobUrl);
            const pathParts = url.pathname.split('/').slice(2); // Remove container name
            blobPath = pathParts.join('/');
        } else {
            // Fallback - this might not work without the hash
            blobPath = `${department}/${fileName}`;
        }
        
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
                blobPath: blobPath,
                permissions: 'r',  // Read permission for preview/download
                expiryMinutes: 60 // Token valid for 1 hour
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sasToken || data.sasUrl;
        }
    } catch (error) {
        console.error('Failed to generate SAS token:', error);
    }
    
    return null;
}

// Replace constructBlobUrl function (line 546-552)
function constructBlobUrl(fileName, department, sasToken) {
    // Find the actual blob path from the document data
    const doc = state.documents.find(d => 
        (d.fileName === fileName || d.title === fileName) && 
        d.department === department
    );
    
    if (doc && doc.blobUrl) {
        // Use the actual blob URL and append SAS token
        const baseUrl = doc.blobUrl.split('?')[0]; // Remove any existing query params
        return `${baseUrl}?${sasToken}`;
    }
    
    // Fallback construction (might not work without hash)
    const baseUrl = `https://${CONFIG.azure.storageAccount}.blob.core.windows.net`;
    const container = CONFIG.azure.containerName;
    const path = `${department}/${fileName}`;
    
    return `${baseUrl}/${container}/${path}?${sasToken}`;
}

// Additional fix for createDocumentCard to properly escape quotes in file names
function escapeQuotes(str) {
    return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
}

// Update the document card creation to handle file names with special characters
// This is a partial replacement for lines in createDocumentCard function
// The onclick handlers should be updated to:
/*
<button class="action-btn" onclick="documentRepository.previewDocument('${doc.id}', '${escapeQuotes(doc.fileName || doc.title)}', '${doc.department}')">
    <span>👁️</span> Preview
</button>
<button class="action-btn" onclick="documentRepository.downloadDocument('${doc.id}', '${escapeQuotes(doc.fileName || doc.title)}', '${doc.department}')">
    <span>⬇️</span> Download
</button>
<button class="btn-delete" onclick="documentRepository.deleteDocument('${doc.id}', '${escapeQuotes(doc.fileName || doc.title)}')">
    <span>🗑️</span>
</button>
*/
