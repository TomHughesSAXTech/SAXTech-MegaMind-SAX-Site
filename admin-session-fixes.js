// Admin Panel Session Management Fixes
// Add this to your admin.html file or include as a separate script

// Global variables for session management
let allLoadedSessions = [];
let selectedSessions = new Set();
let currentFilteredUser = null;
let currentSessionsData = [];

// Store session data for export
window.storeSessionData = function(sessions) {
    currentSessionsData = sessions;
    allLoadedSessions = sessions;
    populateUserDropdown(sessions);
    
    // Show delete controls when sessions are loaded
    document.getElementById('deleteControls').style.display = 'block';
};

// Populate user dropdown when loading sessions
function populateUserDropdown(sessions) {
    const dropdown = document.getElementById('userFilterDropdown');
    const uniqueUsers = [...new Set(sessions.map(s => s.userEmail))].filter(Boolean).sort();
    
    dropdown.innerHTML = '<option value="">All Users</option>';
    uniqueUsers.forEach(email => {
        const option = document.createElement('option');
        option.value = email;
        option.textContent = email;
        dropdown.appendChild(option);
    });
}

// Filter sessions by selected user
function filterSessionsByUser() {
    const selectedUser = document.getElementById('userFilterDropdown').value;
    if (selectedUser) {
        document.getElementById('sessionUserEmail').value = selectedUser;
        loadUserSessions();
    } else {
        // Show all loaded sessions
        displaySessions(allLoadedSessions, true);
    }
}

// Delete selected sessions
async function deleteSelectedSessions() {
    if (selectedSessions.size === 0) {
        showStatus('No sessions selected. Click on sessions to select them.', 'error');
        return;
    }
    
    if (!confirm(`Delete ${selectedSessions.size} selected session(s)?`)) {
        return;
    }
    
    try {
        let deletedCount = 0;
        for (const sessionId of selectedSessions) {
            const response = await fetch('/api/conversations?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    sessionId: sessionId
                })
            });
            
            if (response.ok) {
                deletedCount++;
            }
        }
        
        showStatus(`Deleted ${deletedCount} session(s)`, 'success');
        selectedSessions.clear();
        document.getElementById('selectedCount').textContent = '0 sessions selected';
        
        // Reload the current view
        if (currentFilteredUser) {
            loadUserSessions();
        } else {
            loadAllRecentSessions();
        }
    } catch (error) {
        console.error('Delete error:', error);
        showStatus('Failed to delete sessions: ' + error.message, 'error');
    }
}

// Delete all sessions for current user
async function deleteAllUserSessions() {
    const userEmail = currentFilteredUser || 
                     document.getElementById('sessionUserEmail').value || 
                     document.getElementById('userFilterDropdown').value;
    
    if (!userEmail) {
        showStatus('Please select or enter a user email first', 'error');
        return;
    }
    
    if (!confirm(`Delete ALL sessions for ${userEmail}? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/conversations?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteUser',
                userEmail: userEmail
            })
        });
        
        if (response.ok) {
            showStatus(`Deleted all sessions for ${userEmail}`, 'success');
            selectedSessions.clear();
            loadAllRecentSessions();
        } else {
            const error = await response.text();
            throw new Error(error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showStatus('Failed to delete user sessions: ' + error.message, 'error');
    }
}

// Delete ALL sessions (admin only)
async function confirmDeleteAllSessions() {
    const confirmation = prompt('Type "DELETE ALL" to confirm deletion of ALL sessions for ALL users:');
    
    if (confirmation !== 'DELETE ALL') {
        showStatus('Deletion cancelled', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/conversations?code=w_j-EeXYy7G1yfUBkSVvlT5Hhafzg-eCNkaUOkOzzIveAzFu9NTlQw==', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteAll',
                adminCode: 'ADMIN_DELETE_ALL_2024'
            })
        });
        
        if (response.ok) {
            showStatus('All sessions deleted', 'success');
            document.getElementById('sessionsList').innerHTML = '';
            document.getElementById('sessionResults').style.display = 'none';
            allLoadedSessions = [];
            currentSessionsData = [];
            selectedSessions.clear();
        } else {
            const error = await response.text();
            throw new Error(error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete all error:', error);
        showStatus('Failed to delete all sessions: ' + error.message, 'error');
    }
}

// Fixed Export to Excel function
function exportToExcel() {
    if (!currentSessionsData || currentSessionsData.length === 0) {
        showStatus('No data to export. Please load sessions first.', 'error');
        return;
    }
    
    // Create detailed CSV content
    let csv = 'User Email,User Name,Session ID,Timestamp,AI Profile,Department,Location,Messages,User Messages,Bot Messages,Total Tokens,Duration (min),Tools Used,Models Used,Avg Confidence,Voice Used\n';
    
    currentSessionsData.forEach(session => {
        const messages = session.conversation || [];
        const userMessages = messages.filter(m => m.role === 'user').length;
        const botMessages = messages.filter(m => m.role === 'assistant').length;
        const metadata = session.metadata || {};
        const metrics = session.metrics || {};
        
        // Calculate duration
        let duration = 0;
        if (metadata.sessionStartTime && metadata.sessionEndTime) {
            duration = Math.floor((new Date(metadata.sessionEndTime) - new Date(metadata.sessionStartTime)) / 60000);
        }
        
        // Clean and escape CSV fields
        const escape = (str) => {
            if (!str) return '';
            str = String(str);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };
        
        csv += [
            escape(session.userEmail || ''),
            escape(session.userName || metadata.userName || ''),
            escape(session.sessionId || ''),
            escape(new Date(session.timestamp).toLocaleString()),
            escape(metadata.aiProfile || session.aiProfile || 'default'),
            escape(session.department || metadata.department || ''),
            escape(session.location || metadata.location || ''),
            messages.length,
            userMessages,
            botMessages,
            metrics.totalTokens || 0,
            duration,
            escape((metrics.toolsUsed || []).join('; ')),
            escape((metrics.modelsUsed || []).join('; ')),
            metrics.avgConfidence ? (metrics.avgConfidence * 100).toFixed(1) + '%' : '',
            metrics.voiceAgentUsed ? 'Yes' : 'No'
        ].join(',') + '\n';
    });
    
    // Create and download the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'megamind_sessions_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('Excel export completed - ' + currentSessionsData.length + ' sessions exported', 'success');
}

// Fixed Export to PDF function
function exportToPDF() {
    if (!currentSessionsData || currentSessionsData.length === 0) {
        showStatus('No data to export. Please load sessions first.', 'error');
        return;
    }
    
    // Create formatted HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>SAX MegaMind Session Report</title>
    <style>
        @media print {
            .no-print { display: none; }
            .session { page-break-inside: avoid; }
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .header-info {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .session {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .session-header {
            background: #f8f9fa;
            margin: -20px -20px 15px -20px;
            padding: 15px 20px;
            border-radius: 8px 8px 0 0;
            border-bottom: 2px solid #667eea;
        }
        .metrics {
            display: flex;
            gap: 15px;
            margin: 15px 0;
            flex-wrap: wrap;
        }
        .metric {
            background: #f0f4ff;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
        }
        .conversation {
            border-top: 1px solid #e0e0e0;
            padding-top: 15px;
            margin-top: 15px;
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
        }
        .user-msg {
            background: #e8eaf6;
            margin-left: 20%;
            text-align: right;
        }
        .bot-msg {
            background: #f5f5f5;
            margin-right: 20%;
        }
        .msg-label {
            font-weight: bold;
            color: #667eea;
            font-size: 12px;
            text-transform: uppercase;
        }
        .summary {
            background: #fffbeb;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        @page {
            margin: 0.5in;
        }
    </style>
</head>
<body>
    <h1>🧠 SAX MegaMind AI - Session Report</h1>
    
    <div class="header-info">
        <strong>Report Generated:</strong> ${new Date().toLocaleString()}<br>
        <strong>Total Sessions:</strong> ${currentSessionsData.length}<br>
        <strong>Date Range:</strong> ${document.getElementById('sessionDateRange').options[document.getElementById('sessionDateRange').selectedIndex].text}<br>
        ${currentFilteredUser ? `<strong>User Filter:</strong> ${currentFilteredUser}<br>` : ''}
    </div>
    
    <div class="summary">
        <h3>📊 Summary Statistics</h3>
        <p>
            <strong>Total Messages:</strong> ${currentSessionsData.reduce((sum, s) => sum + (s.conversation?.length || 0), 0)}<br>
            <strong>Unique Users:</strong> ${new Set(currentSessionsData.map(s => s.userEmail)).size}<br>
            <strong>Total Tokens Used:</strong> ${currentSessionsData.reduce((sum, s) => sum + (s.metrics?.totalTokens || 0), 0).toLocaleString()}
        </p>
    </div>
    
    <div class="no-print" style="margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 8px;">
        <strong>💡 Tip:</strong> Press Ctrl+P (or Cmd+P on Mac) to print this page or save as PDF
    </div>
    
    ${currentSessionsData.map((session, index) => {
        const messages = session.conversation || [];
        const metadata = session.metadata || {};
        const metrics = session.metrics || {};
        
        let duration = 'N/A';
        if (metadata.sessionStartTime && metadata.sessionEndTime) {
            const minutes = Math.floor((new Date(metadata.sessionEndTime) - new Date(metadata.sessionStartTime)) / 60000);
            duration = minutes + ' minutes';
        }
        
        return `
        <div class="session">
            <div class="session-header">
                <strong>Session ${index + 1} of ${currentSessionsData.length}</strong><br>
                <strong>User:</strong> ${session.userEmail || 'Unknown'} 
                ${session.userName ? `(${session.userName})` : ''}<br>
                <strong>Session ID:</strong> ${session.sessionId || 'N/A'}<br>
                <strong>Date:</strong> ${new Date(session.timestamp).toLocaleString()}<br>
                ${metadata.aiProfile ? `<strong>AI Profile:</strong> ${metadata.aiProfile}<br>` : ''}
                ${session.department ? `<strong>Department:</strong> ${session.department}<br>` : ''}
            </div>
            
            <div class="metrics">
                <span class="metric">📝 ${messages.length} messages</span>
                ${metrics.totalTokens ? `<span class="metric">🎯 ${metrics.totalTokens} tokens</span>` : ''}
                ${duration !== 'N/A' ? `<span class="metric">⏱️ ${duration}</span>` : ''}
                ${metrics.toolsUsed?.length ? `<span class="metric">🔧 ${metrics.toolsUsed.length} tools used</span>` : ''}
                ${metrics.avgConfidence ? `<span class="metric">📊 ${(metrics.avgConfidence * 100).toFixed(0)}% confidence</span>` : ''}
            </div>
            
            <div class="conversation">
                <strong>Conversation:</strong>
                ${messages.map(msg => `
                    <div class="message ${msg.role === 'user' ? 'user-msg' : 'bot-msg'}">
                        <div class="msg-label">${msg.role === 'user' ? 'USER' : 'ASSISTANT'}</div>
                        ${msg.content || msg.message || ''}
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }).join('')}
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea; text-align: center; color: #666;">
        <p>© ${new Date().getFullYear()} SAX Advisory Group - Confidential</p>
    </div>
</body>
</html>`;
    
    // Open in new window for printing
    const printWindow = window.open('', 'PRINT', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    showStatus('PDF export window opened. Use browser print dialog to save as PDF.', 'success');
}

// Fixed search function
async function searchSessions() {
    const searchTerm = document.getElementById('sessionSearchTerm').value.trim();
    
    if (!searchTerm) {
        showStatus('Please enter a search term', 'error');
        return;
    }
    
    document.getElementById('searchResults').innerHTML = '<p>Searching...</p>';
    
    // Search in loaded sessions first (client-side)
    if (allLoadedSessions.length > 0) {
        const matches = [];
        const searchLower = searchTerm.toLowerCase();
        
        allLoadedSessions.forEach(session => {
            const messages = session.conversation || [];
            let found = false;
            let matchedContent = '';
            
            // Search in messages
            for (const msg of messages) {
                const content = (msg.content || msg.message || '').toLowerCase();
                if (content.includes(searchLower)) {
                    found = true;
                    // Extract excerpt around the match
                    const index = content.indexOf(searchLower);
                    const start = Math.max(0, index - 30);
                    const end = Math.min(content.length, index + searchTerm.length + 30);
                    matchedContent = content.substring(start, end);
                    break;
                }
            }
            
            // Also search in user email
            if (!found && session.userEmail && session.userEmail.toLowerCase().includes(searchLower)) {
                found = true;
                matchedContent = session.userEmail;
            }
            
            if (found) {
                matches.push({
                    session: session,
                    excerpt: matchedContent
                });
            }
        });
        
        // Display results
        if (matches.length === 0) {
            document.getElementById('searchResults').innerHTML = '<p style="color: #999;">No matches found in loaded sessions</p>';
        } else {
            let html = `<p><strong>${matches.length} matches found:</strong></p>`;
            matches.forEach(match => {
                const session = match.session;
                html += `
                    <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #667eea;">
                        <strong>${session.userEmail || 'Unknown User'}</strong><br>
                        <small style="color: #666;">
                            ${new Date(session.timestamp).toLocaleString()} | 
                            Session: ${session.sessionId?.substring(0, 20)}...
                        </small><br>
                        <em style="color: #333;">"...${match.excerpt}..."</em><br>
                        <button class="btn btn-small" style="margin-top: 5px;" onclick="viewSession('${session.sessionId}')">View Session</button>
                    </div>
                `;
            });
            document.getElementById('searchResults').innerHTML = html;
        }
        
        showStatus(`Found ${matches.length} matches in loaded sessions`, 'success');
    } else {
        // If no sessions loaded, inform user
        document.getElementById('searchResults').innerHTML = '<p style="color: #999;">Please load sessions first before searching</p>';
        showStatus('Load sessions before searching', 'warning');
    }
}

// View a specific session
function viewSession(sessionId) {
    const session = allLoadedSessions.find(s => s.sessionId === sessionId);
    if (session) {
        // Display just this session
        displaySessions([session], true);
        // Scroll to the session display
        document.getElementById('sessionResults').scrollIntoView({ behavior: 'smooth' });
    }
}

// Update display sessions to support selection
function enhanceSessionDisplay() {
    // Add click handlers to session items for selection
    const sessionItems = document.querySelectorAll('#sessionsList > div');
    sessionItems.forEach((item, index) => {
        if (allLoadedSessions[index]) {
            const sessionId = allLoadedSessions[index].sessionId;
            
            // Add checkbox for selection
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.marginRight = '10px';
            checkbox.onchange = function() {
                if (this.checked) {
                    selectedSessions.add(sessionId);
                } else {
                    selectedSessions.delete(sessionId);
                }
                updateSelectedCount();
            };
            
            // Insert checkbox at the beginning of the session item
            item.insertBefore(checkbox, item.firstChild);
        }
    });
}

// Update selected count display
function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = `${selectedSessions.size} sessions selected`;
    document.getElementById('deleteSelectedBtn').disabled = selectedSessions.size === 0;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners if elements exist
    if (document.getElementById('userFilterDropdown')) {
        document.getElementById('userFilterDropdown').addEventListener('change', filterSessionsByUser);
    }
    
    // Show delete controls when on sessions tab
    const sessionsTab = document.getElementById('sessions-tab');
    if (sessionsTab) {
        const observer = new MutationObserver(() => {
            if (sessionsTab.classList.contains('active')) {
                if (allLoadedSessions.length > 0) {
                    document.getElementById('deleteControls').style.display = 'block';
                }
            }
        });
        observer.observe(sessionsTab, { attributes: true });
    }
});

// Export functions to global scope
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.searchSessions = searchSessions;
window.deleteSelectedSessions = deleteSelectedSessions;
window.deleteAllUserSessions = deleteAllUserSessions;
window.confirmDeleteAllSessions = confirmDeleteAllSessions;
window.filterSessionsByUser = filterSessionsByUser;
window.viewSession = viewSession;