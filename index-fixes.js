// INDEX.HTML COMPREHENSIVE FIXES
// This file contains all the JavaScript fixes for index.html
// Apply these fixes by replacing the corresponding functions in index.html

// ============================================
// FIX 1: THINKING INDICATOR PERSISTENCE
// ============================================
// Replace the existing sendMessage function section that handles thinking indicator
// Find this section around line 2800-2820 and replace with:

// Add thinking indicator WITHOUT bubble - FIXED VERSION
function addThinkingIndicator() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message bot thinking';
    thinkingDiv.id = 'thinking-indicator'; // Add ID for easy removal
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
    return thinkingDiv;
}

function removeThinkingIndicator() {
    const thinkingDiv = document.getElementById('thinking-indicator');
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
}

// ============================================
// FIX 2: HTML RENDERING WITH PROPER IMAGE HANDLING
// ============================================
// Replace the streaming response handler section (around line 3350-3400)

function processHTMLContent(fullContent) {
    console.log('Processing HTML content, length:', fullContent.length);
    
    // Check if content is HTML
    const isHTMLContent = fullContent.includes('<!DOCTYPE html>') || 
                        fullContent.includes('<html') || 
                        (fullContent.includes('<div') && fullContent.includes('</div>')) ||
                        (fullContent.includes('<h2>') && fullContent.includes('</h2>'));
    
    if (!isHTMLContent) {
        return { isHTML: false, content: fullContent };
    }
    
    // Fix corrupted base64 images
    let fixedContent = fullContent;
    
    // Replace corrupted JPEG headers
    fixedContent = fixedContent.replace(/data:image\/jpeg;base64,[^"'\s]+/g, function(match) {
        // Check if the base64 starts with corrupted characters
        if (match.includes('�') || match.includes('%EF%BF%BD')) {
            console.log('Found corrupted image data, replacing with placeholder');
            // Return a placeholder image
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzY2NiI+SW1hZ2U8L3RleHQ+PC9zdmc+';
        }
        return match;
    });
    
    // Extract just the body content if it's a full HTML document
    let htmlContent = fixedContent;
    if (fixedContent.includes('<body>')) {
        const bodyMatch = fixedContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            htmlContent = bodyMatch[1];
        }
    }
    
    return { isHTML: true, content: htmlContent };
}

// ============================================
// FIX 3: HISTORY SUMMARIES
// ============================================
// Replace the displayHistoryList function (around line 2541-2598)

function displayHistoryList(sessions) {
    const historyList = document.getElementById('historyList');
    
    // Store sessions globally so loadSession can access them
    window.loadedHistorySessions = sessions;
    
    if (sessions.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No conversations yet</div>';
        return;
    }
    
    historyList.innerHTML = '';
    
    sessions.forEach((session, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.onclick = () => loadSession(session.sessionId);
        
        const date = new Date(session.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Generate meaningful preview from conversation
        let preview = 'Empty conversation';
        let summaryTitle = null;
        
        if (session.conversation && session.conversation.length > 0) {
            // Find first substantial user message (not just "hi" or greetings)
            let meaningfulMessage = null;
            
            for (const msg of session.conversation) {
                if ((msg.role === 'user' || msg.type === 'user')) {
                    const content = msg.content || msg.message || '';
                    const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
                    
                    // Skip common greetings and short messages
                    if (cleanContent.length > 5 && 
                        !cleanContent.match(/^(hi|hello|hey|test|testing)$/i)) {
                        meaningfulMessage = cleanContent;
                        break;
                    }
                }
            }
            
            // If no meaningful user message, try assistant messages
            if (!meaningfulMessage) {
                for (const msg of session.conversation) {
                    if ((msg.role === 'assistant' || msg.type === 'bot')) {
                        const content = msg.content || msg.response || msg.message || '';
                        const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
                        
                        // Look for informative assistant responses
                        if (cleanContent.length > 20 && 
                            !cleanContent.includes('How can I help') &&
                            !cleanContent.includes('Hello!')) {
                            // Extract the most relevant part
                            const sentences = cleanContent.split(/[.!?]/);
                            meaningfulMessage = sentences[0] || cleanContent.substring(0, 50);
                            break;
                        }
                    }
                }
            }
            
            // Use the meaningful message or fall back to first message
            if (meaningfulMessage) {
                preview = meaningfulMessage.substring(0, 50) + (meaningfulMessage.length > 50 ? '...' : '');
                // Generate a short title (first 30 chars or first sentence)
                const firstSentence = meaningfulMessage.match(/^[^.!?]*[.!?]/) || [meaningfulMessage.substring(0, 30)];
                summaryTitle = firstSentence[0].substring(0, 30).trim();
            } else {
                // Last resort - use first message
                const firstMessage = session.conversation[0];
                const content = firstMessage.content || firstMessage.message || firstMessage.response || '';
                const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
                preview = cleanContent.substring(0, 50) + (cleanContent.length > 50 ? '...' : '');
                summaryTitle = cleanContent.substring(0, 20).trim();
            }
        }
        
        // Check if session has stored summary/title
        const displayTitle = session.summaryTitle || session.sessionSummary || summaryTitle || preview;
        
        // Don't show "hi" as the title unless it's actually the only content
        if (displayTitle.toLowerCase() === 'hi' && session.conversation && session.conversation.length > 1) {
            // Try to extract a better summary from the conversation
            const topics = extractTopicsFromConversation(session.conversation);
            if (topics) {
                displayTitle = topics;
            }
        }
        
        item.innerHTML = `
            <div class="history-date">${dateStr}</div>
            <div class="history-preview">${displayTitle}</div>
            <div class="history-messages">${session.conversation ? session.conversation.length : 0} messages</div>
        `;
        
        historyList.appendChild(item);
    });
}

// Helper function to extract topics from conversation
function extractTopicsFromConversation(conversation) {
    if (!conversation || conversation.length < 2) return null;
    
    // Keywords that indicate specific topics
    const topicKeywords = {
        'employee': 'Employee Information',
        'staff': 'Staff Details',
        'tom hughes': 'Tom Hughes Info',
        'tax': 'Tax Discussion',
        'audit': 'Audit Related',
        'accounting': 'Accounting Topic',
        'report': 'Report Request',
        'document': 'Document Query',
        'help': 'Help Request',
        'error': 'Error Report',
        'issue': 'Issue Discussion',
        'profile': 'Profile Information',
        'user': 'User Details',
        'session': 'Session Management',
        'voice': 'Voice Settings',
        'api': 'API Discussion'
    };
    
    // Check conversation for keywords
    for (const msg of conversation) {
        const content = (msg.content || msg.message || '').toLowerCase();
        for (const [keyword, topic] of Object.entries(topicKeywords)) {
            if (content.includes(keyword)) {
                return topic;
            }
        }
    }
    
    return null;
}

// ============================================
// FIX 4: UPDATE RESPONSE HANDLER IN sendMessage
// ============================================
// In the fetch response handler (around line 3100-3400), update to:

// After receiving response, before processing:
// Remove thinking indicator when response starts processing
const responseHandler = async (response) => {
    console.log('Response content-type:', response.headers.get('content-type'));
    const contentLength = response.headers.get('content-length');
    console.log('Non-streaming response received, length:', contentLength);
    
    // Remove thinking indicator as soon as we get response
    removeThinkingIndicator();
    
    // Continue with rest of response processing...
    const responseText = await response.text();
    // ... rest of your existing response handling code
};

// ============================================
// APPLY THESE FIXES
// ============================================
/*
To apply these fixes to index.html:

1. Add the addThinkingIndicator() and removeThinkingIndicator() functions
2. In sendMessage(), replace the thinking indicator creation with:
   const thinkingDiv = addThinkingIndicator();
3. In the response handler, add removeThinkingIndicator() when response arrives
4. Replace the displayHistoryList() function with the fixed version
5. Add the extractTopicsFromConversation() helper function
6. Add the processHTMLContent() function for handling corrupted images
7. In the streaming response handler, use processHTMLContent() before displaying HTML

This will fix:
- Thinking indicator staying visible until response arrives
- HTML content with corrupted base64 images
- History showing meaningful summaries instead of just "hi"
*/