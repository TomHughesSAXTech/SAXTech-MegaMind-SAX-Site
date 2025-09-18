// Real-time Metrics Tracker for MegaMind Conversations
// Captures actual usage data during chat sessions

class MetricsTracker {
    constructor() {
        this.sessionMetrics = {
            sessionId: null,
            sessionStartTime: null,
            sessionEndTime: null,
            
            // Model tracking
            modelsUsed: [],
            currentModel: null,
            modelSwitches: 0,
            modelHistory: [],
            
            // Token tracking
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            tokensByModel: {},
            
            // Tool and index usage
            toolsUsed: [],
            toolCallHistory: [],
            indexQueries: 0,
            documentsRetrieved: 0,
            searchQueries: [],
            
            // Voice agent metrics
            voiceAgentUsed: false,
            voiceAgentName: null,
            voiceDuration: 0,
            voiceInterruptions: 0,
            voiceStartTime: null,
            
            // Performance metrics
            responseTimes: [],
            avgResponseTime: null,
            confidenceScores: [],
            avgConfidence: null,
            
            // User interaction metrics
            userFeedback: [],
            regenerations: 0,
            attachments: [],
            errorCount: 0,
            errorDetails: [],
            
            // Message tracking
            messageCount: 0,
            userMessageCount: 0,
            assistantMessageCount: 0,
            
            // Additional context
            department: null,
            location: null,
            aiProfile: 'default'
        };
        
        this.requestStartTime = null;
        this.init();
    }
    
    init() {
        this.sessionMetrics.sessionId = this.generateSessionId();
        this.sessionMetrics.sessionStartTime = new Date().toISOString();
        console.log('Metrics tracker initialized:', this.sessionMetrics.sessionId);
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Track when a request starts
    startRequest() {
        this.requestStartTime = Date.now();
    }
    
    // Track when a response is received
    endRequest() {
        if (this.requestStartTime) {
            const responseTime = Date.now() - this.requestStartTime;
            this.sessionMetrics.responseTimes.push(responseTime);
            this.updateAvgResponseTime();
            this.requestStartTime = null;
            return responseTime;
        }
        return null;
    }
    
    // Update average response time
    updateAvgResponseTime() {
        if (this.sessionMetrics.responseTimes.length > 0) {
            const sum = this.sessionMetrics.responseTimes.reduce((a, b) => a + b, 0);
            this.sessionMetrics.avgResponseTime = Math.round(sum / this.sessionMetrics.responseTimes.length);
        }
    }
    
    // Track model usage
    trackModel(modelName) {
        if (modelName && modelName !== this.sessionMetrics.currentModel) {
            // Track model switch
            if (this.sessionMetrics.currentModel) {
                this.sessionMetrics.modelSwitches++;
            }
            
            this.sessionMetrics.currentModel = modelName;
            
            // Add to models used if not already there
            if (!this.sessionMetrics.modelsUsed.includes(modelName)) {
                this.sessionMetrics.modelsUsed.push(modelName);
            }
            
            // Track history
            this.sessionMetrics.modelHistory.push({
                model: modelName,
                timestamp: new Date().toISOString()
            });
            
            // Initialize token counter for this model if needed
            if (!this.sessionMetrics.tokensByModel[modelName]) {
                this.sessionMetrics.tokensByModel[modelName] = 0;
            }
        }
    }
    
    // Track token usage
    trackTokens(inputTokens, outputTokens, model) {
        const input = parseInt(inputTokens) || 0;
        const output = parseInt(outputTokens) || 0;
        const total = input + output;
        
        this.sessionMetrics.inputTokens += input;
        this.sessionMetrics.outputTokens += output;
        this.sessionMetrics.totalTokens += total;
        
        // Track by model if provided
        if (model) {
            if (!this.sessionMetrics.tokensByModel[model]) {
                this.sessionMetrics.tokensByModel[model] = 0;
            }
            this.sessionMetrics.tokensByModel[model] += total;
        } else if (this.sessionMetrics.currentModel) {
            this.sessionMetrics.tokensByModel[this.sessionMetrics.currentModel] += total;
        }
        
        console.log('Tokens tracked:', { input, output, total, model });
    }
    
    // Estimate tokens from text (rough approximation)
    estimateTokens(text) {
        if (!text) return 0;
        // Rough estimate: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }
    
    // Track tool usage
    trackTool(toolName, details = {}) {
        if (toolName && !this.sessionMetrics.toolsUsed.includes(toolName)) {
            this.sessionMetrics.toolsUsed.push(toolName);
        }
        
        this.sessionMetrics.toolCallHistory.push({
            tool: toolName,
            timestamp: new Date().toISOString(),
            details: details
        });
        
        console.log('Tool tracked:', toolName, details);
    }
    
    // Track search/index queries
    trackSearch(query, documentsFound = 0) {
        this.sessionMetrics.indexQueries++;
        this.sessionMetrics.documentsRetrieved += documentsFound;
        
        this.sessionMetrics.searchQueries.push({
            query: query,
            timestamp: new Date().toISOString(),
            documentsFound: documentsFound
        });
        
        console.log('Search tracked:', { query, documentsFound });
    }
    
    // Track voice agent usage
    startVoiceSession(agentName) {
        this.sessionMetrics.voiceAgentUsed = true;
        this.sessionMetrics.voiceAgentName = agentName;
        this.sessionMetrics.voiceStartTime = Date.now();
        console.log('Voice session started:', agentName);
    }
    
    endVoiceSession() {
        if (this.sessionMetrics.voiceStartTime) {
            const duration = (Date.now() - this.sessionMetrics.voiceStartTime) / 1000; // in seconds
            this.sessionMetrics.voiceDuration += duration;
            this.sessionMetrics.voiceStartTime = null;
            console.log('Voice session ended. Duration:', duration);
            return duration;
        }
        return 0;
    }
    
    trackVoiceInterruption() {
        this.sessionMetrics.voiceInterruptions++;
    }
    
    // Track confidence scores
    trackConfidence(score) {
        const confidence = parseFloat(score);
        if (!isNaN(confidence)) {
            this.sessionMetrics.confidenceScores.push(confidence);
            this.updateAvgConfidence();
        }
    }
    
    updateAvgConfidence() {
        if (this.sessionMetrics.confidenceScores.length > 0) {
            const sum = this.sessionMetrics.confidenceScores.reduce((a, b) => a + b, 0);
            this.sessionMetrics.avgConfidence = sum / this.sessionMetrics.confidenceScores.length;
        }
    }
    
    // Track user feedback
    trackFeedback(type, value) {
        this.sessionMetrics.userFeedback.push({
            type: type,
            value: value,
            timestamp: new Date().toISOString()
        });
    }
    
    // Track regenerations
    trackRegeneration() {
        this.sessionMetrics.regenerations++;
    }
    
    // Track attachments
    trackAttachment(attachment) {
        this.sessionMetrics.attachments.push({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            timestamp: new Date().toISOString()
        });
    }
    
    // Track errors
    trackError(error, details = {}) {
        this.sessionMetrics.errorCount++;
        this.sessionMetrics.errorDetails.push({
            error: error,
            details: details,
            timestamp: new Date().toISOString()
        });
        console.error('Error tracked:', error, details);
    }
    
    // Track messages
    trackMessage(role, content) {
        this.sessionMetrics.messageCount++;
        
        if (role === 'user') {
            this.sessionMetrics.userMessageCount++;
        } else if (role === 'assistant' || role === 'bot') {
            this.sessionMetrics.assistantMessageCount++;
        }
        
        // Estimate tokens for this message
        const estimatedTokens = this.estimateTokens(content);
        if (role === 'user') {
            this.sessionMetrics.inputTokens += estimatedTokens;
        } else {
            this.sessionMetrics.outputTokens += estimatedTokens;
        }
        this.sessionMetrics.totalTokens += estimatedTokens;
    }
    
    // Set user context
    setUserContext(department, location, aiProfile) {
        this.sessionMetrics.department = department;
        this.sessionMetrics.location = location;
        this.sessionMetrics.aiProfile = aiProfile;
    }
    
    // Parse response for metrics
    parseResponseMetrics(response) {
        try {
            // Check for model information
            if (response.model) {
                this.trackModel(response.model);
            }
            
            // Check for token usage
            if (response.usage) {
                this.trackTokens(
                    response.usage.prompt_tokens || response.usage.input_tokens,
                    response.usage.completion_tokens || response.usage.output_tokens,
                    response.model
                );
            }
            
            // Check for tools used
            if (response.tools || response.functions) {
                const tools = response.tools || response.functions;
                tools.forEach(tool => {
                    this.trackTool(tool.name || tool.function || tool);
                });
            }
            
            // Check for confidence score
            if (response.confidence !== undefined) {
                this.trackConfidence(response.confidence);
            }
            
            // Check for search results
            if (response.search_results || response.documents) {
                const docs = response.search_results || response.documents;
                this.trackSearch(response.query || 'search', docs.length || 0);
            }
            
        } catch (error) {
            console.error('Error parsing response metrics:', error);
        }
    }
    
    // Get current metrics
    getMetrics() {
        this.sessionMetrics.sessionEndTime = new Date().toISOString();
        return { ...this.sessionMetrics };
    }
    
    // Reset metrics for new session
    reset() {
        this.init();
    }
    
    // Save metrics to localStorage
    saveToLocal() {
        const metrics = this.getMetrics();
        localStorage.setItem('megamind_session_metrics', JSON.stringify(metrics));
        return metrics;
    }
    
    // Load metrics from localStorage
    loadFromLocal() {
        const saved = localStorage.getItem('megamind_session_metrics');
        if (saved) {
            try {
                const metrics = JSON.parse(saved);
                this.sessionMetrics = { ...this.sessionMetrics, ...metrics };
                return true;
            } catch (error) {
                console.error('Error loading metrics:', error);
            }
        }
        return false;
    }
}

// Initialize global metrics tracker
window.metricsTracker = new MetricsTracker();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetricsTracker;
}