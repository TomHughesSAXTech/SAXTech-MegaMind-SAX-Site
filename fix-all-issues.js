// COMPREHENSIVE FIX FOR ALL 5 ISSUES
// This file contains all the fixes to be applied to index.html and admin.html

// ============================================
// ISSUE 1: FIX STREAMING/BUBBLE PERSISTENCE
// ============================================

// Fix 1A: Update addMessageToUI to use message-bubble class
const fixAddMessageToUI = `
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = \`message \${role}\`;
    
    if (role === 'bot') {
        messageDiv.innerHTML = \`
            <div class="message-avatar">
                <img src="\${aiProfiles[currentAIProfile].robotImage}" alt="\${aiProfiles[currentAIProfile].name}" 
                     onerror="this.style.display='none'; this.parentNode.innerHTML='\${aiProfiles[currentAIProfile].avatar}';">
            </div>
            <div class="message-bubble">\${content}</div>
        \`;
    } else {
        messageDiv.innerHTML = \`<div class="message-content">\${content}</div>\`;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}`;

// Fix 1B: Update loadSessionHistory to use addMessage instead of addMessageToUI
const fixLoadSessionHistory = `
async function loadSessionHistory() {
    if (currentAccount) {
        userSessionId = currentAccount.username + '_session';
        
        // First try to load from Azure
        try {
            const response = await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'load',
                    userEmail: currentAccount.username,
                    sessionId: userSessionId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.conversation && data.conversation.length > 0) {
                    conversationHistory = data.conversation;
                    // Restore messages to chat UI using addMessage
                    conversationHistory.forEach(msg => {
                        if (msg.role === 'user') {
                            addMessage('user', msg.content, null, false);
                        } else if (msg.role === 'assistant') {
                            addMessage('bot', msg.content, null, false);
                        }
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to load from Azure:', error);
        }
        
        // Fallback to localStorage if Azure fails
        const savedHistory = localStorage.getItem(userSessionId);
        if (savedHistory) {
            try {
                const history = JSON.parse(savedHistory);
                conversationHistory = history.messages || [];
                // Restore messages to chat UI
                conversationHistory.forEach(msg => {
                    if (msg.role === 'user') {
                        addMessage('user', msg.content, null, false);
                    } else if (msg.role === 'assistant') {
                        addMessage('bot', msg.content, null, false);
                    }
                });
            } catch (e) {
                console.error('Failed to load session history:', e);
                conversationHistory = [];
            }
        }
    }
}`;

// ============================================
// ISSUE 3: FIX AUDIO PLAYBACK
// ============================================

const fixAudioPlayback = `
// Fixed playAudio function
function playAudio(audioData) {
    try {
        const ttsToggle = document.getElementById('ttsToggle');
        
        // Check if TTS is disabled
        if (!ttsToggle || !ttsToggle.checked) {
            console.log('TTS is disabled, skipping audio playback');
            // Continue conversation without audio
            if (voiceInteractionActive && !recognitionActive && !isAISpeaking) {
                setTimeout(() => startListening(), 1000);
            }
            return;
        }
        
        if (!audioData) {
            console.warn('No audio data provided');
            if (voiceInteractionActive && !recognitionActive && !isAISpeaking) {
                setTimeout(() => startListening(), 1000);
            }
            return;
        }
        
        // Validate audio data
        if (typeof audioData !== 'string' || audioData.length < 100) {
            console.warn('Invalid audio data received');
            if (voiceInteractionActive && !recognitionActive && !isAISpeaking) {
                setTimeout(() => startListening(), 1000);
            }
            return;
        }
        
        isAISpeaking = true;
        
        // Stop any ongoing recognition
        if (recognitionActive && recognition) {
            recognition.stop();
        }
        
        // Stop any existing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        // Support both base64 and data URL formats
        let audioSrc = audioData;
        if (!audioData.startsWith('data:')) {
            // Clean up base64 data - remove any whitespace or newlines
            audioData = audioData.replace(/\\s/g, '');
            audioSrc = 'data:audio/mpeg;base64,' + audioData;
        }
        
        currentAudio = new Audio(audioSrc);
        
        // Set volume
        currentAudio.volume = 0.9;
        
        // Visual feedback while AI is speaking
        const speakerIcon = document.getElementById('speakerIcon');
        const statusText = document.getElementById('statusText');
        const conversationState = document.getElementById('conversationState');
        
        if (speakerIcon) speakerIcon.classList.add('active');
        if (statusText) {
            statusText.textContent = 'AI Speaking...';
            statusText.classList.add('active');
        }
        if (conversationState) conversationState.style.display = 'none';
        
        // Show subtle volume bars while AI is speaking
        const bars = document.querySelectorAll('.volume-bar');
        bars.forEach(bar => {
            bar.classList.add('active');
            bar.style.background = 'rgba(100, 200, 100, 0.3)';
        });
        
        currentAudio.onended = () => {
            isAISpeaking = false;
            if (speakerIcon) speakerIcon.classList.remove('active');
            if (statusText) statusText.classList.remove('active');
            
            // Clear volume bars
            bars.forEach(bar => {
                bar.classList.remove('active');
                bar.style.background = '';
            });
            
            // Only restart listening if in conversational mode
            if (voiceInteractionActive && !conversationStopped) {
                if (statusText) statusText.textContent = 'Ready to listen again...';
                setTimeout(() => {
                    if (!recognitionActive && !isAISpeaking) {
                        startListening();
                    }
                }, 500);
            } else {
                if (statusText) statusText.textContent = 'Tap speaker to start conversation';
            }
        };
        
        currentAudio.onerror = (e) => {
            console.error('Audio playback error:', e);
            isAISpeaking = false;
            if (speakerIcon) speakerIcon.classList.remove('active');
            if (statusText) {
                statusText.classList.remove('active');
                statusText.textContent = 'Audio playback failed';
            }
            
            bars.forEach(bar => {
                bar.classList.remove('active');
                bar.style.background = '';
            });
            
            // Continue conversation even if audio fails
            if (voiceInteractionActive && !conversationStopped) {
                setTimeout(() => {
                    if (!recognitionActive && !isAISpeaking) {
                        startListening();
                    }
                }, 1000);
            }
        };
        
        // Play the audio
        currentAudio.play().catch(err => {
            console.error('Failed to play audio:', err);
            isAISpeaking = false;
            if (speakerIcon) speakerIcon.classList.remove('active');
            if (statusText) statusText.textContent = 'Audio playback blocked';
        });
        
    } catch (error) {
        console.error('Error in playAudio function:', error);
        isAISpeaking = false;
    }
}`;

// ============================================
// ISSUE 4: ADD HISTORY DROPDOWN
// ============================================

const historyHTML = `
<!-- Add this to the chat-header after the header-text div -->
<div class="history-dropdown">
    <button class="history-btn" id="historyBtn" onclick="toggleHistoryMenu()">
        📚 History
    </button>
    <div class="history-menu" id="historyMenu">
        <div class="history-loading" id="historyLoading">Loading...</div>
        <div class="history-empty" id="historyEmpty" style="display: none;">No conversation history</div>
        <div id="historyList"></div>
    </div>
</div>`;

const historyFunctions = `
// History Management Functions
let conversationSessions = [];
let currentSessionId = null;

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(7);
}

function startNewSession() {
    currentSessionId = generateSessionId();
    conversationHistory = [];
    chatMessages.innerHTML = '';
    addMessage('bot', 'Hello! How can I help you today?', null, false);
    saveSessionToAzure();
}

async function loadHistoryFromAzure() {
    if (!currentAccount) return;
    
    try {
        const response = await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'list',
                userEmail: currentAccount.username
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            conversationSessions = data.sessions || [];
            displayHistorySessions();
        }
    } catch (error) {
        console.error('Failed to load history:', error);
        document.getElementById('historyLoading').style.display = 'none';
        document.getElementById('historyEmpty').style.display = 'block';
    }
}

function displayHistorySessions() {
    const historyList = document.getElementById('historyList');
    const historyLoading = document.getElementById('historyLoading');
    const historyEmpty = document.getElementById('historyEmpty');
    
    historyLoading.style.display = 'none';
    
    if (conversationSessions.length === 0) {
        historyEmpty.style.display = 'block';
        historyList.innerHTML = '';
        return;
    }
    
    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';
    
    conversationSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.onclick = () => loadSession(session.sessionId);
        
        const date = new Date(session.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        // Get first user message as preview
        let preview = 'New conversation';
        if (session.conversation && session.conversation.length > 0) {
            const firstUserMessage = session.conversation.find(msg => msg.role === 'user');
            if (firstUserMessage) {
                preview = firstUserMessage.content.substring(0, 50) + '...';
            }
        }
        
        item.innerHTML = \`
            <div class="history-date">\${dateStr}</div>
            <div class="history-preview">\${preview}</div>
            <div class="history-messages">\${session.conversation ? session.conversation.length : 0} messages</div>
        \`;
        
        historyList.appendChild(item);
    });
}

async function loadSession(sessionId) {
    try {
        const response = await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'load',
                sessionId: sessionId,
                userEmail: currentAccount.username
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.conversation) {
                // Clear current chat
                chatMessages.innerHTML = '';
                conversationHistory = data.conversation;
                currentSessionId = sessionId;
                
                // Restore messages
                conversationHistory.forEach(msg => {
                    if (msg.role === 'user') {
                        addMessage('user', msg.content, null, false);
                    } else if (msg.role === 'assistant') {
                        addMessage('bot', msg.content, null, false);
                    }
                });
                
                // Close history menu
                document.getElementById('historyMenu').classList.remove('show');
            }
        }
    } catch (error) {
        console.error('Failed to load session:', error);
    }
}

function toggleHistoryMenu() {
    const menu = document.getElementById('historyMenu');
    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
    } else {
        menu.classList.add('show');
        loadHistoryFromAzure();
    }
}

// Close history menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.history-dropdown')) {
        document.getElementById('historyMenu').classList.remove('show');
    }
});

// Auto-save session every 30 seconds
setInterval(() => {
    if (conversationHistory.length > 0) {
        saveSessionToAzure();
    }
}, 30000);

async function saveSessionToAzure() {
    if (!currentAccount || !currentSessionId) return;
    
    try {
        await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'save',
                sessionId: currentSessionId,
                userEmail: currentAccount.username,
                userName: currentAccount.name || currentAccount.username,
                conversation: conversationHistory,
                timestamp: new Date().toISOString(),
                department: userProfile?.department || null,
                location: userProfile?.location || null,
                aiProfile: currentAIProfile || 'sage'
            })
        });
    } catch (error) {
        console.error('Failed to save session to Azure:', error);
    }
}`;

// ============================================
// ISSUE 5: FIX ADMIN.HTML CONVERSATIONS TAB
// ============================================

const adminConversationsFix = `
// Add this to admin.html in the Conversations tab section
async function loadConversations() {
    const conversationsList = document.getElementById('conversationsList');
    conversationsList.innerHTML = '<div class="loading">Loading conversations...</div>';
    
    try {
        const response = await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'admin-list',
                adminKey: 'sax-admin-2024' // Add authentication
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayConversations(data.conversations || []);
        } else {
            conversationsList.innerHTML = '<div class="error">Failed to load conversations</div>';
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
        conversationsList.innerHTML = '<div class="error">Error loading conversations</div>';
    }
}

function displayConversations(conversations) {
    const conversationsList = document.getElementById('conversationsList');
    
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="empty">No conversations found</div>';
        return;
    }
    
    let html = '<table class="conversations-table">';
    html += '<thead><tr>';
    html += '<th>User</th>';
    html += '<th>Department</th>';
    html += '<th>Date/Time</th>';
    html += '<th>Messages</th>';
    html += '<th>AI Profile</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead><tbody>';
    
    conversations.forEach(conv => {
        const date = new Date(conv.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        html += '<tr>';
        html += \`<td>\${conv.userName || conv.userEmail || 'Unknown'}</td>\`;
        html += \`<td>\${conv.department || 'N/A'}</td>\`;
        html += \`<td>\${dateStr}</td>\`;
        html += \`<td>\${conv.conversation ? conv.conversation.length : 0}</td>\`;
        html += \`<td>\${conv.aiProfile || 'sage'}</td>\`;
        html += \`<td>
            <button onclick="viewConversation('\${conv.sessionId}')" class="btn btn-sm btn-primary">View</button>
            <button onclick="exportConversation('\${conv.sessionId}')" class="btn btn-sm btn-secondary">Export</button>
        </td>\`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    conversationsList.innerHTML = html;
}

async function viewConversation(sessionId) {
    try {
        const response = await fetch('https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'admin-view',
                sessionId: sessionId,
                adminKey: 'sax-admin-2024'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayConversationDetails(data);
        }
    } catch (error) {
        console.error('Failed to view conversation:', error);
    }
}

function displayConversationDetails(data) {
    const modal = document.createElement('div');
    modal.className = 'conversation-modal';
    modal.innerHTML = \`
        <div class="modal-content">
            <div class="modal-header">
                <h3>Conversation Details</h3>
                <button onclick="this.closest('.conversation-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="conversation-info">
                    <p><strong>User:</strong> \${data.userName || data.userEmail}</p>
                    <p><strong>Date:</strong> \${new Date(data.timestamp).toLocaleString()}</p>
                    <p><strong>Department:</strong> \${data.department || 'N/A'}</p>
                </div>
                <div class="conversation-messages">
                    \${formatConversationMessages(data.conversation)}
                </div>
            </div>
        </div>
    \`;
    document.body.appendChild(modal);
}

function formatConversationMessages(messages) {
    let html = '';
    messages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        const className = msg.role === 'user' ? 'user-message' : 'ai-message';
        html += \`
            <div class="message \${className}">
                <strong>\${role}:</strong> \${msg.content}
            </div>
        \`;
    });
    return html;
}

function exportConversation(sessionId) {
    window.open(\`https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==&action=export&sessionId=\${sessionId}\`, '_blank');
}

// Add CSS for conversations display
const conversationsCSS = \`
<style>
.conversations-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

.conversations-table th,
.conversations-table td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}

.conversations-table th {
    background-color: #f5f5f5;
    font-weight: bold;
}

.conversations-table tr:hover {
    background-color: #f9f9f9;
}

.conversation-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.modal-content {
    background: white;
    border-radius: 10px;
    width: 80%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-body {
    padding: 20px;
}

.conversation-info {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #eee;
}

.conversation-messages {
    max-height: 400px;
    overflow-y: auto;
}

.message {
    margin: 10px 0;
    padding: 10px;
    border-radius: 5px;
}

.user-message {
    background: #e3f2fd;
    margin-left: 50px;
}

.ai-message {
    background: #f5f5f5;
    margin-right: 50px;
}

.btn-sm {
    padding: 5px 10px;
    margin: 0 5px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.btn-primary {
    background: #2196F3;
    color: white;
}

.btn-secondary {
    background: #757575;
    color: white;
}

.loading, .empty, .error {
    text-align: center;
    padding: 40px;
    color: #666;
}
</style>
\`;
</script>`;

console.log(`
========================================
COMPREHENSIVE FIXES FOR ALL 5 ISSUES
========================================

TO APPLY THESE FIXES:

1. STREAMING/BUBBLE FIX:
   - Replace addMessageToUI function
   - Replace loadSessionHistory function
   
2. WEBHOOK: Already fixed ✓

3. AUDIO FIX:
   - Replace playAudio function
   
4. HISTORY DROPDOWN:
   - Add HTML to chat-header
   - Add all history functions
   - Initialize on page load
   
5. ADMIN.HTML FIX:
   - Add conversations functions
   - Add CSS styles
   - Initialize on Conversations tab click

All fixes are in this file and can be applied systematically.
`);