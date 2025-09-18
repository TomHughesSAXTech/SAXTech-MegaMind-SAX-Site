// Tax Search Component for SAXTech MegaMind CPA
// Integrates with n8n tax search webhooks for search, feedback, and click tracking

class TaxSearchComponent {
    constructor() {
        this.baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5678/webhook'
            : 'https://n8n.saxtechnology.com/webhook';
        
        this.sessionId = this.getOrCreateSessionId();
        this.userId = this.getUserId();
        this.searchHistory = [];
        this.currentResults = [];
    }

    // Initialize session and user IDs
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('tax_session_id');
        if (!sessionId) {
            sessionId = `tax_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('tax_session_id', sessionId);
        }
        return sessionId;
    }

    getUserId() {
        let userId = localStorage.getItem('tax_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('tax_user_id', userId);
        }
        return userId;
    }

    // Main search function
    async searchTax(query) {
        if (!query || query.trim() === '') {
            return { success: false, error: 'Please enter a tax question' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/tax-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    sessionId: this.sessionId,
                    userId: this.userId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // Store search in history
                this.searchHistory.push({
                    query: query,
                    answer: result.answer,
                    timestamp: new Date().toISOString()
                });
                
                // Store current results for feedback/tracking
                this.currentResults = result.documents || [];
                
                // Track initial view counts
                this.currentResults.forEach(doc => {
                    this.trackDocumentClick(doc.id, 'impression');
                });
            }
            
            return result;
        } catch (error) {
            console.error('Tax search error:', error);
            return {
                success: false,
                error: 'Search failed. Please try again.'
            };
        }
    }

    // Submit feedback (thumbs up/down)
    async submitFeedback(documentId, isPositive, answerId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/tax-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentId: documentId,
                    feedbackType: isPositive ? 'thumbs_up' : 'thumbs_down',
                    answerId: answerId,
                    sessionId: this.sessionId,
                    userId: this.userId
                })
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Feedback submission error:', error);
            return {
                success: false,
                error: 'Failed to submit feedback'
            };
        }
    }

    // Track document clicks/views
    async trackDocumentClick(documentId, action = 'view') {
        try {
            const response = await fetch(`${this.baseUrl}/tax-click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentId: documentId,
                    action: action, // 'view', 'download', 'share', 'impression'
                    sessionId: this.sessionId,
                    userId: this.userId
                })
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Click tracking error:', error);
            // Don't show error to user for tracking failures
            return { success: false };
        }
    }

    // Render search interface HTML
    renderSearchInterface() {
        return `
            <div id="tax-search-container" class="tax-search-wrapper">
                <div class="tax-search-header">
                    <h2>📋 US Tax Code Assistant</h2>
                    <p class="tax-search-subtitle">Ask questions about tax laws, forms, deductions, and regulations</p>
                </div>
                
                <div class="tax-search-box">
                    <input type="text" 
                           id="tax-search-input" 
                           class="tax-search-input"
                           placeholder="e.g., What is the standard deduction for 2024?"
                           onkeypress="if(event.key === 'Enter') taxSearch.performSearch()">
                    <button onclick="taxSearch.performSearch()" class="tax-search-btn">
                        <span>🔍 Search</span>
                    </button>
                </div>

                <div id="tax-search-loading" class="tax-loading hidden">
                    <div class="spinner"></div>
                    <span>Searching tax codes and regulations...</span>
                </div>

                <div id="tax-search-results" class="tax-results hidden">
                    <div id="tax-answer-section" class="tax-answer-card"></div>
                    <div id="tax-documents-section" class="tax-documents"></div>
                </div>

                <div id="tax-search-history" class="tax-history hidden">
                    <h3>Recent Searches</h3>
                    <div id="tax-history-list"></div>
                </div>
            </div>

            <style>
                .tax-search-wrapper {
                    max-width: 900px;
                    margin: 20px auto;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .tax-search-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .tax-search-header h2 {
                    color: #1a1a1a;
                    font-size: 28px;
                    margin-bottom: 8px;
                }

                .tax-search-subtitle {
                    color: #666;
                    font-size: 14px;
                }

                .tax-search-box {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 30px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    padding: 15px;
                    background: white;
                }

                .tax-search-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                }

                .tax-search-input:focus {
                    outline: none;
                    border-color: #2196F3;
                }

                .tax-search-btn {
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .tax-search-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }

                .tax-loading {
                    text-align: center;
                    padding: 30px;
                    color: #666;
                }

                .spinner {
                    display: inline-block;
                    width: 30px;
                    height: 30px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 10px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .tax-answer-card {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border-left: 4px solid #667eea;
                }

                .tax-answer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #eee;
                }

                .tax-answer-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                }

                .tax-answer-feedback {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .feedback-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    border-radius: 20px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                    color: #666;
                }

                .feedback-btn:hover {
                    border-color: #667eea;
                    background: #f8f9ff;
                }

                .feedback-btn.active {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .feedback-btn.thumbs-up.active {
                    background: #4caf50;
                    border-color: #4caf50;
                }

                .feedback-btn.thumbs-down.active {
                    background: #f44336;
                    border-color: #f44336;
                }

                .tax-answer-content {
                    line-height: 1.6;
                    color: #444;
                    white-space: pre-wrap;
                }

                .tax-answer-content p {
                    margin-bottom: 12px;
                }

                .tax-documents {
                    display: grid;
                    gap: 16px;
                }

                .tax-doc-card {
                    background: white;
                    border-radius: 8px;
                    padding: 16px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
                    transition: all 0.2s;
                    cursor: pointer;
                    position: relative;
                }

                .tax-doc-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }

                .tax-doc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }

                .tax-doc-title {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 15px;
                    flex: 1;
                    margin-right: 12px;
                }

                .tax-doc-section {
                    font-size: 12px;
                    color: #7f8c8d;
                    background: #ecf0f1;
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .tax-doc-snippet {
                    color: #555;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 12px;
                }

                .tax-doc-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 12px;
                    border-top: 1px solid #f0f0f0;
                }

                .tax-doc-meta {
                    display: flex;
                    gap: 16px;
                    font-size: 12px;
                    color: #999;
                }

                .tax-doc-actions {
                    display: flex;
                    gap: 8px;
                }

                .doc-action-btn {
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: white;
                    cursor: pointer;
                    font-size: 12px;
                    color: #666;
                    transition: all 0.2s;
                }

                .doc-action-btn:hover {
                    border-color: #667eea;
                    color: #667eea;
                    background: #f8f9ff;
                }

                .confidence-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .confidence-high {
                    background: #d4edda;
                    color: #155724;
                }

                .confidence-medium {
                    background: #fff3cd;
                    color: #856404;
                }

                .confidence-low {
                    background: #f8d7da;
                    color: #721c24;
                }

                .hidden {
                    display: none;
                }

                @media (max-width: 768px) {
                    .tax-search-box {
                        flex-direction: column;
                    }

                    .tax-search-btn {
                        width: 100%;
                    }
                }
            </style>
        `;
    }

    // Perform search from UI
    async performSearch() {
        const input = document.getElementById('tax-search-input');
        const query = input.value.trim();
        
        if (!query) {
            this.showNotification('Please enter a tax question', 'error');
            return;
        }

        // Show loading state
        document.getElementById('tax-search-loading').classList.remove('hidden');
        document.getElementById('tax-search-results').classList.add('hidden');
        
        // Perform search
        const result = await this.searchTax(query);
        
        // Hide loading
        document.getElementById('tax-search-loading').classList.add('hidden');
        
        if (result.success) {
            this.displayResults(result);
        } else {
            this.showNotification(result.error || 'Search failed', 'error');
        }
    }

    // Display search results
    displayResults(result) {
        const resultsContainer = document.getElementById('tax-search-results');
        const answerSection = document.getElementById('tax-answer-section');
        const documentsSection = document.getElementById('tax-documents-section');
        
        // Display AI answer with feedback buttons
        answerSection.innerHTML = `
            <div class="tax-answer-header">
                <div class="tax-answer-title">📚 AI Tax Assistant Answer</div>
                <div class="tax-answer-feedback">
                    <span style="font-size: 12px; color: #999;">Was this helpful?</span>
                    <button class="feedback-btn thumbs-up" onclick="taxSearch.submitAnswerFeedback(true)">
                        👍 Yes
                    </button>
                    <button class="feedback-btn thumbs-down" onclick="taxSearch.submitAnswerFeedback(false)">
                        👎 No
                    </button>
                </div>
            </div>
            <div class="tax-answer-content">${this.formatAnswer(result.answer)}</div>
        `;
        
        // Display source documents
        if (result.documents && result.documents.length > 0) {
            documentsSection.innerHTML = `
                <h3 style="margin-bottom: 16px; color: #333;">📑 Source Documents</h3>
                ${result.documents.map(doc => this.renderDocumentCard(doc)).join('')}
            `;
        } else {
            documentsSection.innerHTML = '';
        }
        
        resultsContainer.classList.remove('hidden');
    }

    // Format answer text with proper line breaks and styling
    formatAnswer(answer) {
        // Convert markdown-style formatting to HTML
        return answer
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background:#f4f4f4;padding:2px 4px;border-radius:3px;">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    // Render individual document card
    renderDocumentCard(doc) {
        const confidence = doc.confidence || 0;
        const confidenceClass = confidence >= 75 ? 'confidence-high' : 
                                confidence >= 50 ? 'confidence-medium' : 
                                'confidence-low';
        
        return `
            <div class="tax-doc-card" onclick="taxSearch.openDocument('${doc.id}')">
                <div class="tax-doc-header">
                    <div class="tax-doc-title">${doc.title || 'Untitled Document'}</div>
                    ${doc.section ? `<span class="tax-doc-section">${doc.section}</span>` : ''}
                </div>
                
                <div class="tax-doc-snippet">${doc.snippet || ''}</div>
                
                <div class="tax-doc-footer">
                    <div class="tax-doc-meta">
                        <span class="confidence-badge ${confidenceClass}">
                            ${Math.round(confidence)}% match
                        </span>
                        <span>👁️ ${doc.viewCount || 0} views</span>
                        ${doc.source ? `<span>📂 ${doc.source}</span>` : ''}
                    </div>
                    
                    <div class="tax-doc-actions">
                        <button class="doc-action-btn" 
                                onclick="event.stopPropagation(); taxSearch.submitDocFeedback('${doc.id}', true)">
                            👍
                        </button>
                        <button class="doc-action-btn" 
                                onclick="event.stopPropagation(); taxSearch.submitDocFeedback('${doc.id}', false)">
                            👎
                        </button>
                        <button class="doc-action-btn" 
                                onclick="event.stopPropagation(); taxSearch.shareDocument('${doc.id}')">
                            🔗
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Open document and track view
    async openDocument(documentId) {
        // Track view
        await this.trackDocumentClick(documentId, 'view');
        
        // Find document in current results
        const doc = this.currentResults.find(d => d.id === documentId);
        
        if (doc) {
            // Open document viewer or external link
            if (doc.link) {
                window.open(doc.link, '_blank');
            } else {
                // Show detailed view in modal
                this.showDocumentModal(doc);
            }
        }
    }

    // Show document in modal
    showDocumentModal(doc) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('tax-doc-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'tax-doc-modal';
            modal.className = 'tax-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="tax-modal-content">
                <div class="tax-modal-header">
                    <h3>${doc.title}</h3>
                    <button onclick="taxSearch.closeModal()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
                </div>
                <div class="tax-modal-body">
                    ${doc.section ? `<p><strong>Section:</strong> ${doc.section}</p>` : ''}
                    ${doc.source ? `<p><strong>Source:</strong> ${doc.source}</p>` : ''}
                    <div style="margin-top:20px;line-height:1.6;">
                        ${doc.content || doc.snippet}
                    </div>
                </div>
                <div class="tax-modal-footer">
                    <button onclick="taxSearch.downloadDocument('${doc.id}')" class="tax-btn-primary">
                        📥 Download
                    </button>
                    <button onclick="taxSearch.closeModal()" class="tax-btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('tax-doc-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Submit feedback for answer
    async submitAnswerFeedback(isPositive) {
        // Visual feedback
        const buttons = document.querySelectorAll('.tax-answer-feedback .feedback-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        if (isPositive) {
            document.querySelector('.feedback-btn.thumbs-up').classList.add('active');
        } else {
            document.querySelector('.feedback-btn.thumbs-down').classList.add('active');
        }
        
        // Submit feedback for the first document (representing the answer)
        if (this.currentResults.length > 0) {
            const result = await this.submitFeedback(this.currentResults[0].id, isPositive, 'answer');
            
            if (result.success) {
                this.showNotification('Thank you for your feedback!', 'success');
            }
        }
    }

    // Submit feedback for document
    async submitDocFeedback(documentId, isPositive) {
        const result = await this.submitFeedback(documentId, isPositive);
        
        if (result.success) {
            // Update UI with new counts
            this.updateDocumentCounts(documentId, result.newCounts);
            this.showNotification('Feedback recorded', 'success');
        }
    }

    // Share document
    async shareDocument(documentId) {
        // Track share action
        await this.trackDocumentClick(documentId, 'share');
        
        // Copy link to clipboard
        const doc = this.currentResults.find(d => d.id === documentId);
        if (doc) {
            const shareUrl = `${window.location.origin}/tax-doc/${documentId}`;
            
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
                this.showNotification('Link copied to clipboard!', 'success');
            } else {
                this.showNotification('Share link: ' + shareUrl, 'info');
            }
        }
    }

    // Download document
    async downloadDocument(documentId) {
        // Track download
        await this.trackDocumentClick(documentId, 'download');
        
        // Trigger download (implement actual download logic based on your backend)
        const doc = this.currentResults.find(d => d.id === documentId);
        if (doc && doc.downloadUrl) {
            window.open(doc.downloadUrl, '_blank');
        } else {
            this.showNotification('Download not available', 'warning');
        }
    }

    // Update document counts in UI
    updateDocumentCounts(documentId, counts) {
        // Update the confidence badge if the element exists
        const card = document.querySelector(`[data-doc-id="${documentId}"]`);
        if (card && counts) {
            const confidenceBadge = card.querySelector('.confidence-badge');
            if (confidenceBadge && counts.confidence !== undefined) {
                confidenceBadge.textContent = `${Math.round(counts.confidence)}% match`;
                
                // Update confidence class
                confidenceBadge.className = 'confidence-badge';
                if (counts.confidence >= 75) {
                    confidenceBadge.classList.add('confidence-high');
                } else if (counts.confidence >= 50) {
                    confidenceBadge.classList.add('confidence-medium');
                } else {
                    confidenceBadge.classList.add('confidence-low');
                }
            }
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `tax-notification tax-notification-${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        // Set background based on type
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        notification.style.background = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize tax search when DOM is ready
let taxSearch;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        taxSearch = new TaxSearchComponent();
    });
} else {
    taxSearch = new TaxSearchComponent();
}

// Add animations
if (!document.getElementById('tax-search-animations')) {
    const style = document.createElement('style');
    style.id = 'tax-search-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .tax-modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.4);
        }
        
        .tax-modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 0;
            border-radius: 12px;
            width: 80%;
            max-width: 700px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .tax-modal-header {
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .tax-modal-body {
            padding: 20px;
            flex: 1;
            overflow-y: auto;
        }
        
        .tax-modal-footer {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .tax-btn-primary {
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        
        .tax-btn-secondary {
            padding: 8px 16px;
            background: #f5f5f5;
            color: #333;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}