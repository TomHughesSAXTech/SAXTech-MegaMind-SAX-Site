// Admin Session Management Functions
// Enhanced features for user filtering and session deletion

// Global variables
let currentSessionsData = [];
let selectedSessions = new Set();
let currentUserFilter = '';

// Helper function to escape HTML and fix invalid images
function escapeHtmlAndFixImages(text) {
    if (!text) return '';
    
    // First escape HTML entities
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Check for and remove invalid base64 images
    // Invalid base64 often starts with malformed characters
    escaped = escaped.replace(/data:image\/[^;]+;base64,[^\s<>"']*/g, (match) => {
        // Check if the base64 string looks invalid (contains invalid characters early on)
        if (match.includes('%EF%BF%BD') || match.includes('���')) {
            return '[Invalid Image]';
        }
        // For valid images, truncate very long base64 strings for display
        if (match.length > 100) {
            return '[Image]';
        }
        return match;
    });
    
    // Also handle img tags with invalid src
    escaped = escaped.replace(/&lt;img[^&]*src=["']?([^"'\s&>]+)[^&]*&gt;/gi, (match, src) => {
        if (src.includes('%EF%BF%BD') || src.includes('���')) {
            return '[Invalid Image]';
        }
        return '[Image]';
    });
    
    return escaped;
}

// Populate user filter dropdown from sessions data
window.populateUserFilter = function(sessions) {
    const dropdown = document.getElementById('userFilterDropdown');
    if (!dropdown) return;
    
    // Get unique users from sessions
    const users = new Map();
    sessions.forEach(session => {
        const email = session.userEmail || 'Unknown User';
        if (!users.has(email)) {
            users.set(email, {
                email: email,
                sessionCount: 1,
                lastActive: session.timestamp
            });
        } else {
            const user = users.get(email);
            user.sessionCount++;
            if (session.timestamp > user.lastActive) {
                user.lastActive = session.timestamp;
            }
        }
    });
    
    // Clear existing options except the first one (All Users)
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    // Sort users by session count (most active first)
    const sortedUsers = Array.from(users.entries())
        .sort((a, b) => b[1].sessionCount - a[1].sessionCount);
    
    // Add users to dropdown
    sortedUsers.forEach(([email, data]) => {
        const option = document.createElement('option');
        option.value = email;
        option.textContent = `${email} (${data.sessionCount} sessions)`;
        dropdown.appendChild(option);
    });
    
    // Show delete controls if we have sessions
    const deleteControls = document.getElementById('deleteControls');
    if (deleteControls) {
        deleteControls.style.display = sessions.length > 0 ? 'block' : 'none';
    }
}

// Filter sessions by selected user
window.filterSessionsByUser = function() {
    const dropdown = document.getElementById('userFilterDropdown');
    const emailInput = document.getElementById('sessionUserEmail');
    
    if (!dropdown) return;
    
    const selectedUser = dropdown.value;
    
    // If a user is selected from dropdown, update the email input
    if (selectedUser && emailInput) {
        emailInput.value = selectedUser;
    }
    
    // If we have sessions loaded, filter them
    if (currentSessionsData.length > 0) {
        const filteredSessions = selectedUser && selectedUser !== '' 
            ? currentSessionsData.filter(s => s.userEmail === selectedUser)
            : currentSessionsData;
        
        displaySessionsEnhanced(filteredSessions, !selectedUser);
        updateSessionStats(filteredSessions);
    }
    
    currentUserFilter = selectedUser;
}

// Enhanced display sessions with checkboxes
window.displaySessionsEnhanced = function(sessions, showUser = false) {
    const container = document.getElementById('sessionsList');
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No sessions found</p>';
        document.getElementById('sessionResults').style.display = 'block';
        updateSelectedCount();
        return;
    }
    
    let html = '';
    sessions.forEach(session => {
        const timestamp = new Date(session.timestamp).toLocaleString();
        
        // Parse conversation data - it might be a JSON string
        let messages = [];
        try {
            if (typeof session.conversation === 'string') {
                const parsed = JSON.parse(session.conversation);
                messages = Array.isArray(parsed) ? parsed : (parsed.messages || []);
            } else if (Array.isArray(session.conversation)) {
                messages = session.conversation;
            } else if (session.conversation && session.conversation.messages) {
                messages = session.conversation.messages;
            }
        } catch (e) {
            console.error('Error parsing conversation:', e);
            messages = [];
        }
        
        const messageCount = messages.length;
        const metrics = session.metrics || {};
        const metadata = session.metadata || {};
        
        // Calculate session duration
        let duration = 'N/A';
        if (metadata.sessionStartTime && metadata.sessionEndTime) {
            const start = new Date(metadata.sessionStartTime);
            const end = new Date(metadata.sessionEndTime);
            const durationMs = end - start;
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            duration = `${minutes}m ${seconds}s`;
        }
        
        html += `
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f9f9f9;" 
                 data-session-id="${session.sessionId}" data-user-email="${session.userEmail || 'unknown'}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" class="session-checkbox" 
                               value="${session.sessionId}" 
                               data-user-email="${session.userEmail || 'unknown'}"
                               onchange="toggleSessionSelection('${session.sessionId}')"
                               style="margin-right: 15px; width: 18px; height: 18px; cursor: pointer;">
                        <div>
                            ${showUser ? `<strong>User:</strong> ${session.userEmail || 'Unknown'}<br>` : ''}
                            <strong>Session:</strong> ${session.sessionId || 'N/A'}<br>
                            <small style="color: #666;">${timestamp}</small>
                            ${metadata.aiProfile ? `<br><small style="color: #667eea;">AI: ${metadata.aiProfile}</small>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">
                            ${messageCount} messages
                        </span>
                        ${metrics.totalTokens ? `<br><span style="background: #fbbf24; color: #333; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-top: 5px; display: inline-block;">${metrics.totalTokens} tokens</span>` : ''}
                        <br>
                        <button class="btn btn-danger btn-small" 
                                onclick="deleteSingleSession('${session.sessionId}')" 
                                style="margin-top: 8px; padding: 4px 8px; font-size: 12px;">
                            Delete
                        </button>
                    </div>
                </div>
                
                <!-- Metrics Bar -->
                ${(metrics.totalTokens || metrics.modelsUsed?.length || metrics.toolsUsed?.length) ? `
                <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                    ${duration !== 'N/A' ? `<span style="background: #e0f2fe; color: #075985; padding: 4px 8px; border-radius: 6px; font-size: 12px;">🕰️ ${duration}</span>` : ''}
                    ${metrics.modelsUsed?.length ? `<span style="background: #f3e8ff; color: #6b21a8; padding: 4px 8px; border-radius: 6px; font-size: 12px;">🤖 ${metrics.modelsUsed.join(', ')}</span>` : ''}
                    ${metrics.avgConfidence ? `<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 6px; font-size: 12px;">🎯 ${(metrics.avgConfidence * 100).toFixed(0)}% confidence</span>` : ''}
                    ${metrics.toolsUsed?.length ? `<span style="background: #fed7aa; color: #9a3412; padding: 4px 8px; border-radius: 6px; font-size: 12px;">🔧 ${metrics.toolsUsed.length} tools</span>` : ''}
                </div>
                ` : ''}
                
                <div style="max-height: 200px; overflow-y: auto; border-top: 1px solid #e0e0e0; padding-top: 10px;">
        `;
        
        messages.forEach((msg, idx) => {
            const isUser = msg.role === 'user';
            html += `
                <div style="margin-bottom: 10px; ${isUser ? 'text-align: right;' : 'text-align: left;'}">
                    <div style="
                        display: inline-block;
                        max-width: 70%;
                        padding: 8px 12px;
                        border-radius: 12px;
                        background: ${isUser ? '#667eea' : '#e0e0e0'};
                        color: ${isUser ? 'white' : '#333'};
                    ">
                        <small style="font-weight: bold;">${isUser ? 'User' : 'Assistant'}</small><br>
                        ${escapeHtmlAndFixImages(msg.content)}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('sessionResults').style.display = 'block';
    updateSelectedCount();
}

// Toggle session selection
window.toggleSessionSelection = function(sessionId) {
    if (selectedSessions.has(sessionId)) {
        selectedSessions.delete(sessionId);
    } else {
        selectedSessions.add(sessionId);
    }
    updateSelectedCount();
}

// Update selected count display
function updateSelectedCount() {
    const countSpan = document.getElementById('selectedCount');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    
    if (countSpan) {
        countSpan.textContent = `${selectedSessions.size} sessions selected`;
    }
    
    if (deleteBtn) {
        deleteBtn.disabled = selectedSessions.size === 0;
    }
}

// Delete single session
window.deleteSingleSession = async function(sessionId) {
    if (!confirm(`Are you sure you want to delete session ${sessionId}?`)) {
        return;
    }
    
    try {
        showStatus('Deleting session...', 'info');
        
        // Use SaveConversationLog API with delete action
        const response = await fetch(`https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'delete',
                sessionId: sessionId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(`Session deleted successfully`, 'success');
            // Remove from current data
            currentSessionsData = currentSessionsData.filter(s => s.sessionId !== sessionId);
            // Refresh display
            filterSessionsByUser();
        } else {
            showStatus('Failed to delete session: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showStatus('Error deleting session: ' + error.message, 'error');
    }
}

// Delete selected sessions
window.deleteSelectedSessions = async function() {
    if (selectedSessions.size === 0) {
        showStatus('No sessions selected', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedSessions.size} selected sessions?`)) {
        return;
    }
    
    try {
        showStatus(`Deleting ${selectedSessions.size} sessions...`, 'info');
        
        // Use POST with delete action for SaveConversationLog Azure function
        const response = await fetch(`https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deleteSessions',
                sessionIds: Array.from(selectedSessions)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(`${result.deletedCount || selectedSessions.size} sessions deleted successfully`, 'success');
            // Remove from current data
            currentSessionsData = currentSessionsData.filter(s => !selectedSessions.has(s.sessionId));
            selectedSessions.clear();
            // Refresh display
            filterSessionsByUser();
        } else {
            showStatus('Failed to delete sessions: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting sessions:', error);
        showStatus('Error deleting sessions: ' + error.message, 'error');
    }
}

// Delete all sessions for current user
window.deleteAllUserSessions = async function() {
    const userEmail = currentUserFilter || document.getElementById('sessionUserEmail')?.value;
    
    if (!userEmail) {
        showStatus('Please select or enter a user email first', 'warning');
        return;
    }
    
    const userSessions = currentSessionsData.filter(s => s.userEmail === userEmail);
    
    if (userSessions.length === 0) {
        showStatus('No sessions found for this user', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ALL ${userSessions.length} sessions for ${userEmail}?`)) {
        return;
    }
    
    try {
        showStatus(`Deleting all sessions for ${userEmail}...`, 'info');
        
        // Use POST with delete action for SaveConversationLog Azure function
        const response = await fetch(`https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deleteUser',
                userEmail: userEmail
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(`All sessions for ${userEmail} deleted successfully`, 'success');
            // Remove from current data
            currentSessionsData = currentSessionsData.filter(s => s.userEmail !== userEmail);
            // Clear selection
            selectedSessions.clear();
            // Refresh display
            populateUserFilter(currentSessionsData);
            displaySessionsEnhanced(currentSessionsData, true);
        } else {
            showStatus('Failed to delete user sessions: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting user sessions:', error);
        showStatus('Error deleting user sessions: ' + error.message, 'error');
    }
}

// Delete ALL sessions (with strong confirmation)
window.confirmDeleteAllSessions = async function() {
    const firstConfirm = confirm('⚠️ WARNING: This will delete ALL sessions for ALL users. Are you absolutely sure?');
    if (!firstConfirm) return;
    
    const secondConfirm = prompt('Type "DELETE ALL SESSIONS" to confirm:');
    if (secondConfirm !== 'DELETE ALL SESSIONS') {
        showStatus('Deletion cancelled', 'info');
        return;
    }
    
    try {
        showStatus('Deleting ALL sessions...', 'info');
        
        // Use POST with delete action for SaveConversationLog Azure function
        const response = await fetch(`https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deleteAll',
                confirmDelete: true
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('All sessions deleted successfully', 'success');
            // Clear everything
            currentSessionsData = [];
            selectedSessions.clear();
            // Refresh display
            document.getElementById('sessionsList').innerHTML = '<p style="color: #999; text-align: center;">No sessions found</p>';
            document.getElementById('userFilterDropdown').innerHTML = '<option value="">All Users</option>';
            updateSessionStats([]);
        } else {
            showStatus('Failed to delete all sessions: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting all sessions:', error);
        showStatus('Error deleting all sessions: ' + error.message, 'error');
    }
}

// Update session statistics
function updateSessionStats(sessions) {
    const totalSessionsEl = document.getElementById('totalSessions');
    const totalMessagesEl = document.getElementById('totalMessages');
    const activeUsersEl = document.getElementById('activeUsers');
    const avgLengthEl = document.getElementById('avgSessionLength');
    
    if (sessions.length === 0) {
        if (totalSessionsEl) totalSessionsEl.textContent = '0';
        if (totalMessagesEl) totalMessagesEl.textContent = '0';
        if (activeUsersEl) activeUsersEl.textContent = '0';
        if (avgLengthEl) avgLengthEl.textContent = '0';
        return;
    }
    
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + (s.conversation?.length || 0), 0);
    const uniqueUsers = new Set(sessions.map(s => s.userEmail || 'unknown')).size;
    const avgLength = totalSessions > 0 ? (totalMessages / totalSessions).toFixed(1) : 0;
    
    if (totalSessionsEl) totalSessionsEl.textContent = totalSessions.toLocaleString();
    if (totalMessagesEl) totalMessagesEl.textContent = totalMessages.toLocaleString();
    if (activeUsersEl) activeUsersEl.textContent = uniqueUsers.toLocaleString();
    if (avgLengthEl) avgLengthEl.textContent = avgLength;
}

// Modified loadUserSessions to use enhanced display
window.loadUserSessions = async function() {
    const emailInput = document.getElementById('sessionUserEmail');
    const dateRange = document.getElementById('sessionDateRange');
    const loading = document.getElementById('sessionLoading');
    
    const userEmail = emailInput?.value || currentUserFilter || '';
    const range = dateRange?.value || 'week';
    
    if (!userEmail) {
        showStatus('Please enter or select a user email', 'warning');
        return;
    }
    
    if (loading) loading.style.display = 'block';
    
    try {
        const url = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?action=get&email=${encodeURIComponent(userEmail)}&range=${range}&code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`;
        console.log('Loading user sessions from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {}
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('User sessions data:', data);
        
        // Handle the response format from SaveConversationLog - try multiple formats
        let sessions = [];
        if (Array.isArray(data)) {
            sessions = data;
        } else if (data.sessions) {
            sessions = data.sessions;
        } else if (data.conversations) {
            sessions = data.conversations;
        } else if (data.data) {
            sessions = Array.isArray(data.data) ? data.data : [];
        }
        console.log('Parsed sessions:', sessions);
        
        if (sessions && sessions.length > 0) {
            currentSessionsData = sessions;
            populateUserFilter(currentSessionsData);
            displaySessionsEnhanced(sessions, false);
            updateSessionStats(sessions);
            // Call analytics update if function exists
            if (typeof updateSessionAnalytics === 'function') {
                updateSessionAnalytics(sessions);
            }
            showStatus(`Loaded ${sessions.length} sessions for ${userEmail}`, 'success');
        } else {
            showStatus('No sessions found for this user', 'info');
            currentSessionsData = [];
            document.getElementById('sessionsList').innerHTML = '<p style="color: #999; text-align: center;">No sessions found</p>';
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showStatus('Error loading sessions: ' + error.message, 'error');
    } finally {
        if (loading) loading.style.display = 'none';
        document.getElementById('sessionResults').style.display = 'block';
    }
};

// Modified loadAllRecentSessions to use enhanced display with fallback aggregation
window.loadAllRecentSessions = async function() {
    const loading = document.getElementById('sessionLoading');
    const dateRange = document.getElementById('sessionDateRange');
    const range = dateRange?.value || 'week';
    
    if (loading) loading.style.display = 'block';
    
    try {
        // First try with wildcard
        let url = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?action=get&email=*&range=${range}&code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`;
        console.log('Trying to load all recent sessions with wildcard:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {}
        });
        
        console.log('Response status:', response.status);
        
        let sessions = [];
        let useAggregation = false;
        
        // Check if wildcard worked
        if (response.ok) {
            try {
                const data = await response.json();
                console.log('Recent sessions data:', data);
                
                // Handle the response format from SaveConversationLog - try multiple formats
                if (Array.isArray(data)) {
                    sessions = data;
                } else if (data.sessions) {
                    sessions = data.sessions;
                } else if (data.conversations) {
                    sessions = data.conversations;
                } else if (data.data) {
                    sessions = Array.isArray(data.data) ? data.data : [];
                }
                
                // If we got sessions, use them
                if (sessions && sessions.length > 0) {
                    console.log('Wildcard worked, got', sessions.length, 'sessions');
                } else {
                    useAggregation = true;
                }
            } catch (err) {
                console.error('Error parsing wildcard response:', err);
                useAggregation = true;
            }
        } else {
            console.log('Wildcard failed with status:', response.status);
            useAggregation = true;
        }
        
        // If wildcard didn't work, aggregate from known users
        if (useAggregation) {
            console.log('Using aggregation approach for known users');
            
            // List of known user emails - expand this list as needed
            const knownUsers = [
                'tom@saxtechnology.com',
                'robert@saxadvisorygroup.com',
                'admin@saxtechnology.com',
                'support@saxtechnology.com',
                'info@saxtechnology.com',
                // Add more users as needed
            ];
            
            sessions = [];
            
            // Fetch sessions for each known user
            for (const email of knownUsers) {
                try {
                    const userUrl = `https://saxtechconversationlogs.azurewebsites.net/api/SaveConversationLog?action=get&email=${encodeURIComponent(email)}&range=${range}&code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==`;
                    console.log(`Loading sessions for ${email}`);
                    
                    const userResponse = await fetch(userUrl);
                    if (userResponse.ok) {
                        const userResult = await userResponse.json();
                        let userSessions = [];
                        
                        // Parse different response formats
                        if (Array.isArray(userResult)) {
                            userSessions = userResult;
                        } else if (userResult.sessions) {
                            userSessions = userResult.sessions;
                        } else if (userResult.conversations) {
                            userSessions = userResult.conversations;
                        } else if (userResult.data) {
                            userSessions = Array.isArray(userResult.data) ? userResult.data : [];
                        }
                        
                        if (Array.isArray(userSessions) && userSessions.length > 0) {
                            // Add user email to each session for identification
                            userSessions.forEach(s => {
                                if (!s.userEmail && !s.email) {
                                    s.userEmail = email;
                                }
                            });
                            sessions = sessions.concat(userSessions);
                            console.log(`Found ${userSessions.length} sessions for ${email}`);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to load sessions for ${email}:`, err);
                }
            }
            
            // Sort all aggregated sessions by timestamp (most recent first)
            if (sessions.length > 0) {
                sessions.sort((a, b) => {
                    const dateA = new Date(a.timestamp || a.createdAt || a.date || 0);
                    const dateB = new Date(b.timestamp || b.createdAt || b.date || 0);
                    return dateB - dateA;
                });
                console.log(`Aggregated ${sessions.length} total sessions from ${knownUsers.length} users`);
            }
        }
        
        console.log('Final parsed sessions:', sessions);
        
        if (sessions && sessions.length > 0) {
            currentSessionsData = sessions;
            populateUserFilter(currentSessionsData);
            displaySessionsEnhanced(sessions, true);
            updateSessionStats(sessions);
            // Call analytics update if function exists
            if (typeof updateSessionAnalytics === 'function') {
                updateSessionAnalytics(sessions);
            }
            showStatus(`Loaded ${sessions.length} recent sessions`, 'success');
        } else {
            showStatus('No recent sessions found', 'info');
            currentSessionsData = [];
            document.getElementById('sessionsList').innerHTML = '<p style="color: #999; text-align: center;">No sessions found</p>';
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showStatus('Error loading sessions: ' + error.message, 'error');
    } finally {
        if (loading) loading.style.display = 'none';
        document.getElementById('sessionResults').style.display = 'block';
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Replace the existing displaySessions function with enhanced version
    if (window.displaySessions) {
        window.displaySessions = displaySessionsEnhanced;
    }
});

// Helper function to show status messages
function showStatus(message, type = 'info') {
    // Create or update status element
    let statusEl = document.getElementById('statusMessage');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'statusMessage';
        statusEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(statusEl);
    }
    
    // Set colors based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    statusEl.style.background = colors[type] || colors.info;
    statusEl.style.color = 'white';
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }, 3000);
}