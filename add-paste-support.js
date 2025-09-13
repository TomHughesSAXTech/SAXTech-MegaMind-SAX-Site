// Add this to your index.html to support pasting images
// Place this code after your messageInput is defined

// Add paste event listener to the message input
messageInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if it's an image
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // Prevent default paste
            
            const blob = item.getAsFile();
            if (blob) {
                // Convert to base64
                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64Data = event.target.result;
                    
                    // Create a preview in the chat
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'pasted-image-preview';
                    previewDiv.innerHTML = `
                        <img src="${base64Data}" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; border-radius: 8px; margin: 10px 0;">
                        <span style="display: block; font-size: 12px; color: #666;">Screenshot pasted - will be sent with message</span>
                    `;
                    
                    // Add to attachments area or create one
                    let attachmentsPreview = document.getElementById('attachments-preview');
                    if (!attachmentsPreview) {
                        attachmentsPreview = document.createElement('div');
                        attachmentsPreview.id = 'attachments-preview';
                        messageInput.parentElement.insertBefore(attachmentsPreview, messageInput);
                    }
                    attachmentsPreview.appendChild(previewDiv);
                    
                    // Add to attachedFiles array for sending
                    attachedFiles.push({
                        name: `screenshot_${Date.now()}.png`,
                        type: 'image/png',
                        size: blob.size,
                        data: base64Data, // Include actual data
                        isScreenshot: true
                    });
                    
                    console.log('Screenshot pasted and ready to send');
                };
                reader.readAsDataURL(blob);
            }
        }
    }
});

// Modify your sendMessage function to handle image data
// In the payload construction, update attachments to include data:
// attachments: attachedFiles.map(f => ({
//     name: f.name,
//     type: f.type,
//     size: f.size,
//     data: f.data || null,  // Include base64 data if available
//     isScreenshot: f.isScreenshot || false
// }))