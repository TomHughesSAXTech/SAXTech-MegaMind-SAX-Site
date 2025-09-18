// Session Export Utilities
// Export functions for Excel and PDF generation

// Track all session data globally for export
let allSessionData = [];
let sessionMetrics = {};

// Export to Excel function
async function exportToExcel() {
    if (allSessionData.length === 0) {
        alert('No session data available to export. Please load sessions first.');
        return;
    }

    try {
        // Prepare Excel data
        const excelData = prepareExcelData(allSessionData);
        
        // Create CSV content (Excel-compatible)
        const csv = convertToCSV(excelData);
        
        // Download CSV file
        downloadCSV(csv, `session_report_${new Date().toISOString().split('T')[0]}.csv`);
        
    } catch (error) {
        console.error('Export to Excel failed:', error);
        alert('Failed to export data to Excel');
    }
}

// Prepare data for Excel export
function prepareExcelData(sessions) {
    const rows = [];
    
    // Add header row
    rows.push([
        'Session ID',
        'User Email',
        'User Name',
        'Timestamp',
        'Department',
        'Location',
        'Message Count',
        'Duration (minutes)',
        'AI Profile',
        'Models Used',
        'Total Tokens',
        'Input Tokens',
        'Output Tokens',
        'Tools Used',
        'Index Queries',
        'Documents Retrieved',
        'Voice Agent',
        'Voice Duration (seconds)',
        'Avg Response Time (ms)',
        'Avg Confidence Score',
        'Error Count',
        'Conversation Summary'
    ]);
    
    // Add data rows
    sessions.forEach(session => {
        const metrics = session.metrics || {};
        const metadata = session.metadata || {};
        
        // Calculate duration
        let duration = 'N/A';
        if (metadata.sessionStartTime && metadata.sessionEndTime) {
            const start = new Date(metadata.sessionStartTime);
            const end = new Date(metadata.sessionEndTime);
            duration = Math.round((end - start) / 1000 / 60); // minutes
        }
        
        // Get conversation summary (first 3 messages)
        const conversationSummary = (session.conversation || [])
            .slice(0, 3)
            .map(msg => `${msg.role}: ${msg.content.substring(0, 50)}...`)
            .join(' | ');
        
        rows.push([
            session.sessionId || '',
            session.userEmail || '',
            session.userName || '',
            session.timestamp || '',
            metadata.department || '',
            metadata.location || '',
            metadata.messageCount || 0,
            duration,
            metadata.aiProfile || 'default',
            (metrics.modelsUsed || []).join(', '),
            metrics.totalTokens || 0,
            metrics.inputTokens || 0,
            metrics.outputTokens || 0,
            (metrics.toolsUsed || []).join(', '),
            metrics.indexQueries || 0,
            metrics.documentsRetrieved || 0,
            metrics.voiceAgentName || 'None',
            metrics.voiceDuration || 0,
            metrics.avgResponseTime || 0,
            metrics.avgConfidence ? (metrics.avgConfidence * 100).toFixed(1) + '%' : 'N/A',
            metrics.errorCount || 0,
            conversationSummary
        ]);
    });
    
    return rows;
}

// Convert data to CSV format
function convertToCSV(data) {
    return data.map(row => {
        return row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma or newline
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        }).join(',');
    }).join('\n');
}

// Download CSV file
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export to PDF function
async function exportToPDF() {
    if (allSessionData.length === 0) {
        alert('No session data available to export. Please load sessions first.');
        return;
    }

    try {
        // Create PDF content
        const pdfContent = preparePDFContent(allSessionData);
        
        // Open in new window for printing/saving as PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        // Auto-trigger print dialog
        setTimeout(() => {
            printWindow.print();
        }, 500);
        
    } catch (error) {
        console.error('Export to PDF failed:', error);
        alert('Failed to export data to PDF');
    }
}

// Prepare content for PDF export
function preparePDFContent(sessions) {
    const now = new Date().toLocaleString();
    const metrics = calculateOverallMetrics(sessions);
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Session Analytics Report - ${now}</title>
            <style>
                @page { margin: 20mm; }
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                h1 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                h2 { color: #333; margin-top: 30px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
                .metric-box { background: #f5f5f5; padding: 15px; border-radius: 8px; }
                .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
                .metric-label { color: #666; font-size: 14px; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #667eea; color: white; padding: 10px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #ddd; }
                tr:nth-child(even) { background: #f9f9f9; }
                .conversation { background: #f0f4ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
                .user-msg { text-align: right; color: #667eea; }
                .assistant-msg { text-align: left; color: #333; }
                @media print { 
                    .no-print { display: none; }
                    body { font-size: 12px; }
                }
            </style>
        </head>
        <body>
            <h1>SAXTech MegaMind - Session Analytics Report</h1>
            <div class="header">
                <div>Generated: ${now}</div>
                <div>Total Sessions: ${sessions.length}</div>
            </div>
            
            <h2>Executive Summary</h2>
            <div class="metrics-grid">
                <div class="metric-box">
                    <div class="metric-value">${metrics.totalSessions}</div>
                    <div class="metric-label">Total Sessions</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">${metrics.uniqueUsers}</div>
                    <div class="metric-label">Unique Users</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">${metrics.totalMessages}</div>
                    <div class="metric-label">Total Messages</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">${metrics.totalTokens.toLocaleString()}</div>
                    <div class="metric-label">Total Tokens Used</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">${metrics.avgConfidence}%</div>
                    <div class="metric-label">Average Confidence</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">${metrics.mostUsedModel}</div>
                    <div class="metric-label">Most Used Model</div>
                </div>
            </div>
            
            <h2>Usage Analytics</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Average Session Duration</td>
                    <td>${metrics.avgDuration} minutes</td>
                </tr>
                <tr>
                    <td>Total Voice Interactions</td>
                    <td>${metrics.voiceInteractions}</td>
                </tr>
                <tr>
                    <td>Total Index Queries</td>
                    <td>${metrics.totalIndexQueries}</td>
                </tr>
                <tr>
                    <td>Documents Retrieved</td>
                    <td>${metrics.totalDocsRetrieved}</td>
                </tr>
                <tr>
                    <td>Tools Used</td>
                    <td>${metrics.uniqueTools.join(', ') || 'None'}</td>
                </tr>
                <tr>
                    <td>Error Rate</td>
                    <td>${metrics.errorRate}%</td>
                </tr>
            </table>
            
            <h2>Model Usage Distribution</h2>
            <table>
                <tr>
                    <th>Model</th>
                    <th>Usage Count</th>
                    <th>Tokens Used</th>
                </tr>
                ${generateModelUsageRows(metrics.modelDistribution)}
            </table>
            
            <h2>Department Distribution</h2>
            <table>
                <tr>
                    <th>Department</th>
                    <th>Sessions</th>
                    <th>Messages</th>
                </tr>
                ${generateDepartmentRows(sessions)}
            </table>
            
            <h2>Recent Sessions Detail</h2>
            ${generateSessionDetails(sessions.slice(0, 10))}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
                <small>© 2025 SAXTechnology - MegaMind Analytics Report</small>
            </div>
        </body>
        </html>
    `;
    
    return html;
}

// Calculate overall metrics from sessions
function calculateOverallMetrics(sessions) {
    const metrics = {
        totalSessions: sessions.length,
        uniqueUsers: new Set(sessions.map(s => s.userEmail)).size,
        totalMessages: 0,
        totalTokens: 0,
        avgConfidence: 0,
        mostUsedModel: 'N/A',
        avgDuration: 0,
        voiceInteractions: 0,
        totalIndexQueries: 0,
        totalDocsRetrieved: 0,
        uniqueTools: new Set(),
        errorRate: 0,
        modelDistribution: {}
    };
    
    let totalConfidence = 0;
    let confidenceCount = 0;
    let totalDuration = 0;
    let durationCount = 0;
    let totalErrors = 0;
    
    sessions.forEach(session => {
        const sessionMetrics = session.metrics || {};
        const metadata = session.metadata || {};
        
        // Count messages
        metrics.totalMessages += (session.conversation || []).length;
        
        // Token usage
        metrics.totalTokens += sessionMetrics.totalTokens || 0;
        
        // Confidence scores
        if (sessionMetrics.avgConfidence) {
            totalConfidence += sessionMetrics.avgConfidence;
            confidenceCount++;
        }
        
        // Duration
        if (metadata.sessionStartTime && metadata.sessionEndTime) {
            const duration = (new Date(metadata.sessionEndTime) - new Date(metadata.sessionStartTime)) / 1000 / 60;
            totalDuration += duration;
            durationCount++;
        }
        
        // Voice interactions
        if (sessionMetrics.voiceAgentUsed) {
            metrics.voiceInteractions++;
        }
        
        // Index and document queries
        metrics.totalIndexQueries += sessionMetrics.indexQueries || 0;
        metrics.totalDocsRetrieved += sessionMetrics.documentsRetrieved || 0;
        
        // Tools used
        (sessionMetrics.toolsUsed || []).forEach(tool => metrics.uniqueTools.add(tool));
        
        // Errors
        totalErrors += sessionMetrics.errorCount || 0;
        
        // Model distribution
        (sessionMetrics.modelsUsed || []).forEach(model => {
            metrics.modelDistribution[model] = (metrics.modelDistribution[model] || 0) + 1;
        });
    });
    
    // Calculate averages
    metrics.avgConfidence = confidenceCount > 0 ? 
        ((totalConfidence / confidenceCount) * 100).toFixed(1) : 'N/A';
    metrics.avgDuration = durationCount > 0 ? 
        (totalDuration / durationCount).toFixed(1) : 'N/A';
    metrics.errorRate = sessions.length > 0 ? 
        ((totalErrors / sessions.length) * 100).toFixed(1) : 0;
    
    // Find most used model
    const modelEntries = Object.entries(metrics.modelDistribution);
    if (modelEntries.length > 0) {
        metrics.mostUsedModel = modelEntries.sort((a, b) => b[1] - a[1])[0][0];
    }
    
    metrics.uniqueTools = Array.from(metrics.uniqueTools);
    
    return metrics;
}

// Generate model usage rows for PDF
function generateModelUsageRows(modelDistribution) {
    const entries = Object.entries(modelDistribution);
    if (entries.length === 0) {
        return '<tr><td colspan="3" style="text-align: center;">No model usage data available</td></tr>';
    }
    
    return entries
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => `
            <tr>
                <td>${model}</td>
                <td>${count}</td>
                <td>-</td>
            </tr>
        `).join('');
}

// Generate department distribution rows
function generateDepartmentRows(sessions) {
    const deptStats = {};
    
    sessions.forEach(session => {
        const dept = session.metadata?.department || 'Unknown';
        if (!deptStats[dept]) {
            deptStats[dept] = { sessions: 0, messages: 0 };
        }
        deptStats[dept].sessions++;
        deptStats[dept].messages += (session.conversation || []).length;
    });
    
    const entries = Object.entries(deptStats);
    if (entries.length === 0) {
        return '<tr><td colspan="3" style="text-align: center;">No department data available</td></tr>';
    }
    
    return entries
        .sort((a, b) => b[1].sessions - a[1].sessions)
        .map(([dept, stats]) => `
            <tr>
                <td>${dept}</td>
                <td>${stats.sessions}</td>
                <td>${stats.messages}</td>
            </tr>
        `).join('');
}

// Generate session details for PDF
function generateSessionDetails(sessions) {
    if (sessions.length === 0) {
        return '<p>No sessions available</p>';
    }
    
    return sessions.map(session => `
        <div class="conversation">
            <strong>Session ID:</strong> ${session.sessionId}<br>
            <strong>User:</strong> ${session.userEmail}<br>
            <strong>Time:</strong> ${new Date(session.timestamp).toLocaleString()}<br>
            <strong>Messages:</strong> ${(session.conversation || []).length}<br>
            ${session.metrics ? `
                <strong>Tokens:</strong> ${session.metrics.totalTokens || 0} | 
                <strong>Model:</strong> ${(session.metrics.modelsUsed || []).join(', ') || 'N/A'}
            ` : ''}
        </div>
    `).join('');
}

// Update session data storage
function storeSessionData(sessions) {
    allSessionData = sessions;
    sessionMetrics = calculateOverallMetrics(sessions);
}

// Export functions to global scope
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.storeSessionData = storeSessionData;