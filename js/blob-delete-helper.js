/**
 * Blob Delete Helper
 * Direct blob deletion from Azure Storage using SAS tokens
 */

(function() {
    'use strict';

    // Generate SAS token for blob deletion
    async function generateDeleteSAS(fileName, department) {
        const API_CONFIG = {
            baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
            functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw=='
        };

        try {
            const sasUrl = `${API_CONFIG.baseUrl}/GenerateSASToken?code=${API_CONFIG.functionKey}`;
            const response = await fetch(sasUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: fileName,
                    department: department,
                    containerName: 'saxdocuments',
                    permissions: 'd', // Delete permission
                    expiryMinutes: 5
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.sasUrl || data.blobUrl;
            }
        } catch (error) {
            console.error('Failed to generate SAS token for deletion:', error);
        }
        return null;
    }

    // Delete blob directly using Azure Storage REST API
    async function deleteBlobDirect(fileName, department) {
        try {
            // Get SAS token with delete permission
            const sasUrl = await generateDeleteSAS(fileName, department);
            if (!sasUrl) {
                console.error('Could not generate SAS token for blob deletion');
                return false;
            }

            // Send DELETE request to blob URL
            const deleteResponse = await fetch(sasUrl, {
                method: 'DELETE',
                headers: {
                    'x-ms-delete-snapshots': 'include' // Delete blob and all snapshots
                }
            });

            if (deleteResponse.ok || deleteResponse.status === 202) {
                console.log(`Blob deleted successfully: ${fileName} from ${department}`);
                return true;
            } else if (deleteResponse.status === 404) {
                console.log(`Blob not found: ${fileName} in ${department}`);
                return true; // Consider it successful if blob doesn't exist
            } else {
                console.error(`Failed to delete blob: ${deleteResponse.status}`);
                return false;
            }
        } catch (error) {
            console.error('Error deleting blob directly:', error);
            return false;
        }
    }

    // Expose functions globally
    window.blobDeleteHelper = {
        generateDeleteSAS,
        deleteBlobDirect
    };
})();