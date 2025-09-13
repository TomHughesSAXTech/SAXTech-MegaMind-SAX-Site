// QUICK FIX - Add this to your index.html to include image context in the message
// This will work WITHOUT needing n8n changes

// Replace the existing sendMessage function payload creation (around line 2056-2075)
// with this enhanced version:

                // Prepare comprehensive payload with full user context
                // ADD IMAGE CONTEXT TO MESSAGE
                let enhancedMessage = message;
                if (attachedFiles.length > 0 && attachedFiles.some(f => f.isScreenshot)) {
                    enhancedMessage = message + '\n\n[User has pasted a screenshot/image - please acknowledge that you would need OCR processing to read its contents. Ask them to describe what they see or what specific part they need help with.]';
                }
                
                const payload = {
                    message: enhancedMessage,  // Use enhanced message
                    sessionId: sessionId,
                    profile: currentAIProfile,
                    voice: currentVoiceId,
                    voiceId: currentVoiceId,
                    voiceName: currentVoiceName,
                    selectedVoice: currentVoice,
                    enableTTS: ttsEnabled,
                    ttsSummaryLength: 'short',
                    ttsSummarize: true,
                    voiceConfig: JSON.parse(localStorage.getItem('megamind_voice_config') || '[]'),
                    attachments: attachedFiles.map(f => ({
                        name: f.name,
                        type: f.type,
                        size: f.size,
                        data: f.data || null,
                        isScreenshot: f.isScreenshot || false
                    })),
                    // ... rest of payload