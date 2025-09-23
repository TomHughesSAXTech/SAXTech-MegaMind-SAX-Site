/**
 * Direct Blob Deletion Helper
 * Bypasses the problematic DeleteBlob Azure Function and deletes blobs directly using Azure Storage REST API
 */

(function() {
    'use strict';

    /**
     * Delete a blob directly from Azure Storage using SAS token
     * @param {string} fileName - The file name (just the filename, not the full path)
     * @param {string} department - The department folder name
     * @param {string} containerName - The storage container name
     * @returns {Promise<boolean>} - True if deletion was successful
     */
    async function deleteBlobDirect(fileName, department, containerName = 'saxdocuments') {
        try {
            console.log(`Direct blob deletion attempt: ${fileName} from ${department}`);
            
            // First, generate a SAS token with delete permissions
            const sasToken = await generateDeleteSASToken(fileName, department, containerName);
            
            if (!sasToken) {
                console.error('Could not generate SAS token for deletion');
                return false;
            }
            
            // Construct the blob URL
            const storageAccount = 'saxtechmegamind';
            const blobPath = department ? `${department}/${fileName}` : fileName;
            const blobUrl = `https://${storageAccount}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobPath)}?${sasToken}`;
            
            console.log(`Attempting to delete blob at: ${blobUrl.split('?')[0]}`);
            
            // Delete the blob using Azure Storage REST API
            const response = await fetch(blobUrl, {
                method: 'DELETE',
                headers: {
                    'x-ms-version': '2020-08-04',
                    'x-ms-date': new Date().toUTCString()
                }
            });
            
            if (response.ok || response.status === 404) {
                // 404 means the blob was already deleted, which is fine
                console.log('Blob deletion successful or blob was already deleted');
                return true;
            } else {
                console.error('Blob deletion failed:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText);
                return false;
            }
            
        } catch (error) {
            console.error('Error in direct blob deletion:', error);
            return false;
        }
    }
    
    /**
     * Generate a SAS token with delete permissions
     */
    async function generateDeleteSASToken(fileName, department, containerName) {
        try {
            const url = 'https://saxtechmegamindfunctions.azurewebsites.net/api/GenerateSASToken?code=zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==';
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw=='
                },
                body: JSON.stringify({
                    fileName: fileName,
                    department: department,
                    containerName: containerName,
                    expiryMinutes: 5, // Short expiry for security
                    permissions: 'rd' // Read and Delete permissions
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.sasToken;
            } else {
                console.error('Failed to generate delete SAS token:', response.statusText);
                return null;
            }
        } catch (error) {
            console.error('Error generating delete SAS token:', error);
            return null;
        }
    }
    
    /**
     * Alternative method: Try to delete blob by listing all blobs and finding exact matches
     */
    async function deleteBlobBySearch(fileName, department, containerName = 'saxdocuments') {
        try {
            console.log(`Searching for blob to delete: ${fileName} in ${department}`);
            
            // Generate SAS token for listing blobs
            const sasToken = await generateDeleteSASToken('', '', containerName);
            if (!sasToken) {
                return false;
            }
            
            // List all blobs and find the one we want to delete
            const storageAccount = 'saxtechmegamind';
            const listUrl = `https://${storageAccount}.blob.core.windows.net/${containerName}?${sasToken}&restype=container&comp=list`;
            
            const listResponse = await fetch(listUrl);
            if (!listResponse.ok) {
                console.error('Could not list blobs for deletion search');
                return false;
            }
            
            const listXml = await listResponse.text();
            console.log('Blob list response:', listXml);
            
            // Parse XML to find matching blob
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(listXml, 'text/xml');
            const blobs = xmlDoc.querySelectorAll('Blob Name');
            
            let targetBlobName = null;
            const searchName = fileName.toLowerCase();
            const searchDept = department.toLowerCase();
            
            for (const blobNameEl of blobs) {
                const blobName = blobNameEl.textContent;
                const blobNameLower = blobName.toLowerCase();
                
                // Check if this blob matches our target
                if (blobNameLower.includes(searchName) && blobNameLower.includes(searchDept)) {
                    targetBlobName = blobName;
                    console.log(`Found matching blob: ${targetBlobName}`);
                    break;
                }
            }
            
            if (!targetBlobName) {
                console.log('No matching blob found for deletion');
                return false;
            }
            
            // Delete the found blob
            const deleteUrl = `https://${storageAccount}.blob.core.windows.net/${containerName}/${encodeURIComponent(targetBlobName)}?${sasToken}`;
            
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'x-ms-version': '2020-08-04',
                    'x-ms-date': new Date().toUTCString()
                }
            });
            
            if (deleteResponse.ok || deleteResponse.status === 404) {
                console.log(`Successfully deleted blob: ${targetBlobName}`);
                return true;
            } else {
                console.error('Blob deletion failed:', deleteResponse.status, deleteResponse.statusText);
                return false;
            }
            
        } catch (error) {
            console.error('Error in blob search and delete:', error);
            return false;
        }
    }
    
    // Export functions to global scope
    window.blobDeleteDirect = {
        deleteBlobDirect: deleteBlobDirect,
        deleteBlobBySearch: deleteBlobBySearch
    };
    
})();