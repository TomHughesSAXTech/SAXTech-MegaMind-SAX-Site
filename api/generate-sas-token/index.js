/**
 * Azure Function: Generate SAS Token for Blob Access
 * This function generates SAS tokens ONLY for document preview and download
 * It does NOT affect the upload process in any way
 */

const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    context.log('Generate SAS Token function triggered');

    try {
        // Get request parameters
        const { fileName, department, containerName, permissions = 'r', expiryMinutes = 60 } = req.body;

        if (!fileName) {
            context.res = {
                status: 400,
                body: { error: 'fileName is required' }
            };
            return;
        }

        // Azure Storage configuration
        const accountName = process.env.AZURE_STORAGE_ACCOUNT || 'saxtechmegamind';
        const accountKey = process.env.AZURE_STORAGE_KEY;
        const container = containerName || 'saxdocuments';

        if (!accountKey) {
            context.log.error('Azure Storage key not configured');
            context.res = {
                status: 500,
                body: { error: 'Storage configuration error' }
            };
            return;
        }

        // Create credentials
        const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

        // Construct blob path
        const blobPath = department 
            ? `original-documents/${department.toLowerCase()}/${fileName}`
            : `original-documents/${fileName}`;

        // Set SAS token expiry
        const startsOn = new Date();
        const expiresOn = new Date(startsOn);
        expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

        // Configure permissions (read-only for preview/download)
        const blobSASPermissions = new BlobSASPermissions();
        blobSASPermissions.read = true;
        
        // Never grant write permissions for security
        blobSASPermissions.write = false;
        blobSASPermissions.delete = false;
        blobSASPermissions.create = false;

        // Generate SAS token
        const sasToken = generateBlobSASQueryParameters({
            containerName: container,
            blobName: blobPath,
            permissions: blobSASPermissions,
            startsOn: startsOn,
            expiresOn: expiresOn,
        }, sharedKeyCredential).toString();

        // Return the SAS token and full URL
        const blobUrl = `https://${accountName}.blob.core.windows.net/${container}/${blobPath}?${sasToken}`;

        context.res = {
            status: 200,
            body: {
                sasToken: sasToken,
                blobUrl: blobUrl,
                expiresOn: expiresOn.toISOString(),
                path: blobPath
            }
        };

    } catch (error) {
        context.log.error('Error generating SAS token:', error);
        context.res = {
            status: 500,
            body: { error: 'Failed to generate SAS token', details: error.message }
        };
    }
};
