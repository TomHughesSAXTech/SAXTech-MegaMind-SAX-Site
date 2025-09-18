// CHAT RESPONSE FIXES
// Fixes: 
// 1. Thinking indicator disappearing before response is displayed
// 2. HTML responses not showing in white bubble for non-streaming
// 3. Remove "Part X/Y" from document preview titles

// ============================================
// FIX 1: THINKING INDICATOR THAT STAYS UNTIL RESPONSE IS DISPLAYED
// ============================================
// Replace the thinking indicator section in sendMessage function (around line 2803-2818)

// Add this right after "sendBtn.classList.add('stop-mode');"
const thinkingDiv = document.createElement('div');
thinkingDiv.className = 'message bot thinking';
thinkingDiv.id = 'thinking-indicator';
thinkingDiv.style.opacity = '0';
thinkingDiv.style.animation = 'fadeIn 0.8s ease-in forwards';
thinkingDiv.innerHTML = `
    <div class="message-avatar">
        <img src="${aiProfiles[currentAIProfile].robotImage}" alt="${aiProfiles[currentAIProfile].name}" 
             onerror="this.style.display='none'; this.parentNode.innerHTML='${aiProfiles[currentAIProfile].avatar}';">
    </div>
    <div class="thinking-container" style="flex: 1; padding-left: 15px;">
        <span class="thinking-text" style="color: rgba(255, 255, 255, 0.5); font-size: 14px; font-style: italic;">
            Thinking...
        </span>
    </div>
`;
chatMessages.appendChild(thinkingDiv);
chatMessages.scrollTop = chatMessages.scrollHeight;

// ============================================
// FIX 2: REMOVE THINKING AND ADD PROPER RESPONSE DISPLAY
// ============================================
// In the response handler (around line 3187-3400), replace the response processing:

// After detecting NDJSON format and before creating messageDiv:
// Remove thinking indicator ONLY when we start displaying the actual response
const removeThinkingIndicator = () => {
    const thinkingDiv = document.getElementById('thinking-indicator');
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
};

// ============================================
// FIX 3: HTML RESPONSE IN WHITE BUBBLE FOR NON-STREAMING
// ============================================
// Replace the section that handles HTML content (around line 3350-3397)

// After assembling full response:
if (fullContent) {
    console.log('Assembled full response:', fullContent);
    
    // Remove thinking indicator now that we have content to display
    removeThinkingIndicator();
    
    // Check if content is HTML
    const isHTMLContent = fullContent.includes('<!DOCTYPE html>') || 
                        fullContent.includes('<html') || 
                        (fullContent.includes('<div') && fullContent.includes('</div>')) ||
                        (fullContent.includes('<h2>') || fullContent.includes('<h3>')) ||
                        (fullContent.includes('<p>') && fullContent.includes('</p>'));
    
    if (isHTMLContent) {
        console.log('HTML content detected, displaying in bubble');
        
        // FIX: Process document titles to remove "Part X/Y"
        let processedContent = fullContent;
        
        // Remove "Part X/Y" patterns from document titles
        processedContent = processedContent.replace(
            /<h4[^>]*>📄\s*([^<]+?)\s*-\s*Part\s*\d+\/\d+<\/h4>/gi,
            '<h4 style="margin: 0 0 10px 0; color: #333;">📄 $1</h4>'
        );
        
        // Also handle variations without the dash
        processedContent = processedContent.replace(
            /<h4[^>]*>📄\s*([^<]+?)\s*Part\s*\d+\/\d+<\/h4>/gi,
            '<h4 style="margin: 0 0 10px 0; color: #333;">📄 $1</h4>'
        );
        
        // Create proper message with bubble for HTML content
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.style.opacity = '0';
        messageDiv.style.animation = 'fadeIn 0.5s ease-in forwards';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${aiProfiles[currentAIProfile].robotImage}" alt="${aiProfiles[currentAIProfile].name}" 
                     onerror="this.style.display='none'; this.parentNode.innerHTML='${aiProfiles[currentAIProfile].avatar}';">
            </div>
            <div class="message-bubble">
                ${processedContent}
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Save to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: fullContent,
            timestamp: new Date().toISOString()
        });
        saveSessionHistory();
        
        // Handle audio if available
        if (audioData && audioData.length > 100) {
            console.log('Playing audio for HTML response');
            playAudio(audioData);
        }
        
    } else {
        // For non-HTML content, display with regular streaming effect
        console.log('Plain text content, using streaming display');
        
        // Remove thinking and create streaming message
        removeThinkingIndicator();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot streaming';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${aiProfiles[currentAIProfile].robotImage}" alt="${aiProfiles[currentAIProfile].name}" 
                     onerror="this.style.display='none'; this.parentNode.innerHTML='${aiProfiles[currentAIProfile].avatar}';">
            </div>
            <div class="message-bubble">
                <span class="streaming-text"></span>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        
        const streamingText = messageDiv.querySelector('.streaming-text');
        
        // Stream the text content
        const words = fullContent.split(/\s+/);
        let currentIndex = 0;
        
        const streamInterval = setInterval(() => {
            if (currentIndex < words.length) {
                streamingText.textContent += (currentIndex > 0 ? ' ' : '') + words[currentIndex];
                currentIndex++;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } else {
                clearInterval(streamInterval);
                messageDiv.classList.remove('streaming');
                
                // Save to history
                conversationHistory.push({
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date().toISOString()
                });
                saveSessionHistory();
                
                // Play audio if available
                if (audioData && audioData.length > 100) {
                    playAudio(audioData);
                }
            }
        }, 50);
    }
}

// ============================================
// FIX 4: UPDATED STREAMING HANDLER FOR CONSISTENCY
// ============================================
// For true streaming responses (EventSource), also ensure thinking is removed:

// In the EventSource message handler:
eventSource.onmessage = function(event) {
    // ... existing parsing code ...
    
    // Remove thinking indicator when first content arrives
    if (!hasRemovedThinking) {
        removeThinkingIndicator();
        hasRemovedThinking = true;
    }
    
    // ... rest of streaming handler
};

// ============================================
// FIX 5: ERROR HANDLING - REMOVE THINKING ON ERROR
// ============================================
// In the catch block of the fetch:
catch (error) {
    console.error('Error sending message:', error);
    
    // Remove thinking indicator on error
    removeThinkingIndicator();
    
    // ... rest of error handling
}

// ============================================
// HELPER FUNCTION FOR DOCUMENT TITLE CLEANING
// ============================================
function cleanDocumentTitle(title) {
    // Remove "Part X/Y" patterns from document titles
    return title
        .replace(/\s*-?\s*Part\s+\d+\/\d+/gi, '')
        .replace(/\s*\(\s*\d+\/\d+\s*\)/gi, '')
        .replace(/\s*#\d+\/\d+/gi, '')
        .trim();
}

// ============================================
// APPLY THESE FIXES TO index.html
// ============================================
/*
IMPLEMENTATION STEPS:

1. In sendMessage() function:
   - Keep thinking indicator with ID 'thinking-indicator'
   - Don't remove it immediately after fetch

2. In response handler:
   - Only remove thinking when actual content is ready to display
   - For HTML content: display in message-bubble (white bubble)
   - For plain text: use streaming display

3. Process all HTML content to remove "Part X/Y" patterns from document titles

4. Test with both streaming and non-streaming responses

This ensures:
- Thinking indicator stays visible until response is displayed
- HTML content appears in proper white bubble
- Document titles are clean without chunk numbers
- Consistent user experience for all response types
*/