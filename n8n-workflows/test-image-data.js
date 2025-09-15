// Test script to validate base64 image data
// Run this in n8n Code node to test if image data is valid

const testBase64Image = () => {
    // Sample webhook data structure
    const sampleData = {
        sessionId: "test-123",
        message: "What's in this image?",
        attachments: [
            {
                name: "screenshot.png",
                type: "image/png",
                isScreenshot: true,
                // This should be your actual base64 data
                data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            }
        ]
    };
    
    const attachment = sampleData.attachments[0];
    
    // Extract base64 data
    let base64Data = attachment.data;
    if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
    }
    
    // Validate base64
    try {
        // Test if it's valid base64
        const buffer = Buffer.from(base64Data, 'base64');
        console.log('Base64 is valid');
        console.log('Buffer length:', buffer.length);
        
        // Check if it starts with PNG signature
        const pngSignature = buffer.slice(0, 8);
        const isPNG = pngSignature[0] === 0x89 && 
                      pngSignature[1] === 0x50 && 
                      pngSignature[2] === 0x4E && 
                      pngSignature[3] === 0x47;
        
        // Check if it starts with JPEG signature  
        const jpegSignature = buffer.slice(0, 3);
        const isJPEG = jpegSignature[0] === 0xFF && 
                       jpegSignature[1] === 0xD8 && 
                       jpegSignature[2] === 0xFF;
        
        console.log('Is PNG:', isPNG);
        console.log('Is JPEG:', isJPEG);
        
        // Return the buffer for use
        return {
            valid: true,
            buffer: buffer,
            mimeType: isPNG ? 'image/png' : isJPEG ? 'image/jpeg' : 'application/octet-stream',
            size: buffer.length
        };
        
    } catch (error) {
        console.error('Invalid base64:', error);
        return {
            valid: false,
            error: error.message
        };
    }
};

// For n8n Code node - validate incoming data
const items = $input.all();
const webhookData = items[0].json;
const data = webhookData.body || webhookData;
const attachments = data.attachments || [];

if (attachments.length > 0) {
    const attachment = attachments[0];
    console.log('Testing first attachment:', attachment.name);
    
    // Extract and validate base64
    let base64Data = attachment.data;
    if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
    }
    
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Log details
        console.log('Attachment name:', attachment.name);
        console.log('Attachment type:', attachment.type);
        console.log('Base64 length:', base64Data.length);
        console.log('Buffer size:', buffer.length, 'bytes');
        console.log('First 10 bytes:', Array.from(buffer.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Check file signatures
        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50;
        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
        const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
        
        console.log('File type detection:');
        console.log('- PNG:', isPNG);
        console.log('- JPEG:', isJPEG);
        console.log('- PDF:', isPDF);
        
        // Return validation result
        return [{
            json: {
                valid: true,
                fileName: attachment.name,
                mimeType: attachment.type,
                bufferSize: buffer.length,
                isPNG,
                isJPEG,
                isPDF,
                base64Sample: base64Data.substring(0, 50) + '...'
            }
        }];
        
    } catch (error) {
        return [{
            json: {
                valid: false,
                error: error.message,
                fileName: attachment.name
            }
        }];
    }
} else {
    return [{
        json: {
            error: 'No attachments found in webhook data'
        }
    }];
}