const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    context.log('Voice Configuration Management Function triggered (Blob Storage)');

    // Storage configuration
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "megamind-config";
    const blobName = "voice-config.json";

    if (!connectionString) {
        context.res = {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key, x-user-email"
            },
            body: { error: 'Storage connection string not configured' }
        };
        return;
    }

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
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key, x-user-email"
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
            // Retrieve voice configuration from blob storage
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
                        { name: 'Clyde', id: '2EiwWnXFnvU5JabPnv8n' },
                        { name: 'Roger', id: 'CwhRBWXzGAHq8TQ4Fs17' },
                        { name: 'Sarah', id: 'EXAVITQu4vr4xnSDxMaL' },
                        { name: 'Laura', id: 'FGY2WhTYpPnrIDTdsKH5' },
                        { name: 'Charlie', id: 'IKne3meq5aSn9XLyUdCD' },
                        { name: 'George', id: 'JBFqnCBsd6RMkjVDRZzb' },
                        { name: 'Callum', id: 'N2lVS1w4EtoT3dr4eOWO' },
                        { name: 'River', id: 'SAz9YHcvj6GT2YYXdXww' },
                        { name: 'Harry', id: 'SOYHLrjzK2X1ezoPC6cr' },
                        { name: 'Liam', id: 'TX3LPaxmHKxFdv7VOQHJ' },
                        { name: 'Alice', id: 'Xb7hH8MSUJpSbSDYk0k2' },
                        { name: 'Matilda', id: 'XrExE9yKIg1WjnnlVkGX' },
                        { name: 'Will', id: 'bIHbv24MWmeRgasZH58o' },
                        { name: 'Jessica', id: 'cgSgspJ2msm6clMCkdW9' },
                        { name: 'Eric', id: 'cjVigY5qzO86Huf0OWal' },
                        { name: 'Chris', id: 'iP95p4xoKVk53GoZ742B' },
                        { name: 'Brian', id: 'nPczCjzI2devNBz1zQrb' },
                        { name: 'Daniel', id: 'onwK4e9ZLuTAKqWW03F9' },
                        { name: 'Lily', id: 'pFZP5JQG7iQjIQuC4Bku' },
                        { name: 'Bill', id: 'pqHfZKP75CvOlQylNhV4' },
                        { name: 'Mark - ConvoAI', id: '1SM7GgM6IMuvQlz2BwM3' },
                        { name: 'RoboTom AI', id: 'F53iDingKDeZwPTLpLOU' },
                        { name: 'Eryn - Hyper Real, Conversation, Natural', id: 'kdnRe2koJdOK4Ovxn2DI' },
                        { name: 'Hope - Your conversational bestie', id: 'uYXf8XasLslADfZ2MB4u' }
                    ],
                    lastUpdated: new Date().toISOString(),
                    updatedBy: 'system'
                };
                
                // Create the default config in blob storage
                await blockBlobClient.upload(JSON.stringify(defaultConfig, null, 2), JSON.stringify(defaultConfig).length);
                
                context.res = {
                    status: 200,
                    headers: headers,
                    body: defaultConfig
                };
            }
            
        } else if (req.method === "POST") {
            // Update voice configuration (admin only)
            const adminKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
            
            // Admin key check
            if (adminKey !== 'SAXAdmin2024') {
                context.res = {
                    status: 401,
                    headers: headers,
                    body: { error: 'Unauthorized: Invalid admin key' }
                };
                return;
            }
            
            const newConfig = req.body;
            
            // Validate the payload
            if (!newConfig || !Array.isArray(newConfig.voices)) {
                context.res = {
                    status: 400,
                    headers: headers,
                    body: { error: 'Invalid payload: voices array is required' }
                };
                return;
            }

            // Validate each voice
            for (const voice of newConfig.voices) {
                if (!voice.name || !voice.id) {
                    context.res = {
                        status: 400,
                        headers: headers,
                        body: { error: 'Invalid payload: each voice must have name and id' }
                    };
                    return;
                }
            }
            
            // Add metadata
            newConfig.lastUpdated = new Date().toISOString();
            newConfig.updatedBy = req.headers['x-user-email'] || 'admin';
            
            // Save to blob storage
            const content = JSON.stringify(newConfig, null, 2);
            await blockBlobClient.upload(content, content.length, {
                overwrite: true,
                metadata: {
                    updatedBy: newConfig.updatedBy,
                    updatedAt: newConfig.lastUpdated,
                    voiceCount: newConfig.voices.length.toString()
                }
            });
            
            context.log(`Voice configuration updated successfully: ${newConfig.voices.length} voices saved`);
            
            context.res = {
                status: 200,
                headers: headers,
                body: {
                    success: true,
                    message: `Voice configuration updated successfully with ${newConfig.voices.length} voices`,
                    lastModified: newConfig.lastUpdated,
                    voiceCount: newConfig.voices.length,
                    voices: newConfig.voices.map(v => ({ name: v.name, id: v.id }))
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