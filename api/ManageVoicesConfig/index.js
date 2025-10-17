// API function for managing voice configuration
module.exports = async function (context, req) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: ''
        };
        return;
    }

    // Default voice configuration
    const defaultVoiceConfig = {
        voices: [
            {
                id: "alloy",
                name: "Alloy",
                description: "Balanced and natural sounding voice",
                model: "tts-1-hd",
                speed: 1.0,
                enabled: true
            },
            {
                id: "echo",
                name: "Echo",
                description: "Clear and articulate voice",
                model: "tts-1-hd", 
                speed: 1.0,
                enabled: true
            },
            {
                id: "fable",
                name: "Fable",
                description: "Expressive storytelling voice",
                model: "tts-1-hd",
                speed: 1.0,
                enabled: true
            },
            {
                id: "onyx",
                name: "Onyx",
                description: "Deep and authoritative voice",
                model: "tts-1-hd",
                speed: 1.0,
                enabled: true
            },
            {
                id: "nova",
                name: "Nova",
                description: "Bright and energetic voice",
                model: "tts-1-hd",
                speed: 1.0,
                enabled: true
            },
            {
                id: "shimmer",
                name: "Shimmer",
                description: "Warm and friendly voice",
                model: "tts-1-hd",
                speed: 1.0,
                enabled: true
            }
        ],
        defaultVoice: "alloy",
        lastModified: new Date().toISOString()
    };

    try {
        if (req.method === 'GET') {
            // Return voice configuration
            context.res = {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(defaultVoiceConfig)
            };
        } else if (req.method === 'POST') {
            // Handle voice configuration update
            const voiceConfig = req.body;
            
            if (!voiceConfig || !voiceConfig.voices) {
                context.res = {
                    status: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Invalid voice configuration' })
                };
                return;
            }

            // In a real implementation, you would save this to a database
            // For now, we'll just return success with the updated config
            const updatedConfig = {
                ...voiceConfig,
                lastModified: new Date().toISOString()
            };

            context.res = {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Voice configuration updated successfully',
                    config: updatedConfig
                })
            };
        } else {
            context.res = {
                status: 405,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        context.log.error('Error in ManageVoicesConfig:', error);
        context.res = {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};