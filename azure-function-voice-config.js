// Azure Function: ManageVoiceConfig
// This function manages centralized voice configuration for all MegaMind users
// Deploy this to your Azure Function App

const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    context.log('Voice Configuration Management Function triggered');

    // Your storage account connection string
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "DefaultEndpointsProtocol=https;AccountName=saxtechmegamind;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net";
    const containerName = "megamind-config";
    const blobName = "voice-config.json";

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // CORS headers for browser access
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle OPTIONS for CORS
    if (req.method === "OPTIONS") {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    try {
        if (req.method === "GET") {
            // Retrieve voice configuration
            try {
                const downloadResponse = await blockBlobClient.download();
                const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
                const config = JSON.parse(downloaded.toString());
                
                context.res = {
                    status: 200,
                    headers: headers,
                    body: config
                };
            } catch (error) {
                // If blob doesn't exist, return default configuration
                const defaultConfig = {
                    voices: [
                        { name: 'Rachel', id: 'EXAVITQu4vr4xnSDxMaL' },
                        { name: 'Clyde', id: 'onwK4e9ZLuTAKqWW03F9' },
                        { name: 'Charlotte', id: 'XB0fDUnXU5powFXDhCwa' },
                        { name: 'Bill', id: 'pqHfZKP75CvOlQylNhV4' },
                        { name: 'George', id: 'JBFqnCBsd6RMkjVDRZzb' },
                        { name: 'Domi', id: 'AZnzlk1XvdvUeBnXmlld' },
                        { name: 'Nicole', id: 'piTKgcLEGmPE4e6mEKli' },
                        { name: 'Jessie', id: 'Zlb1dXrM653N07WRdFW3' }
                    ],
                    lastUpdated: new Date().toISOString(),
                    updatedBy: 'system'
                };
                
                // Create the default config
                await blockBlobClient.upload(JSON.stringify(defaultConfig, null, 2), JSON.stringify(defaultConfig).length);
                
                context.res = {
                    status: 200,
                    headers: headers,
                    body: defaultConfig
                };
            }
            
        } else if (req.method === "POST") {
            // Update voice configuration (admin only)
            // In production, add authentication check here
            const adminKey = req.headers['x-admin-key'];
            
            // Simple admin key check (replace with proper auth)
            if (adminKey !== 'SAXAdmin2024') {
                context.res = {
                    status: 401,
                    headers: headers,
                    body: { error: 'Unauthorized' }
                };
                return;
            }
            
            const newConfig = req.body;
            newConfig.lastUpdated = new Date().toISOString();
            newConfig.updatedBy = req.headers['x-user-email'] || 'admin';
            
            // Save to blob storage
            const content = JSON.stringify(newConfig, null, 2);
            await blockBlobClient.upload(content, content.length, {
                overwrite: true,
                metadata: {
                    updatedBy: newConfig.updatedBy,
                    updatedAt: newConfig.lastUpdated
                }
            });
            
            context.res = {
                status: 200,
                headers: headers,
                body: {
                    success: true,
                    message: 'Voice configuration updated successfully',
                    config: newConfig
                }
            };
        } else {
            context.res = {
                status: 405,
                headers: headers,
                body: { error: 'Method not allowed' }
            };
        }
    } catch (error) {
        context.log.error('Error in Voice Config Function:', error);
        context.res = {
            status: 500,
            headers: headers,
            body: { error: 'Internal server error', details: error.message }
        };
    }
};

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on("error", reject);
    });
}