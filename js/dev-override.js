// Development override for local testing
// Provides mock data when CORS blocks API calls

(function() {
    'use strict';
    
    console.log('[DevOverride] Loaded development overrides for local testing');
    
    // Mock conversation data for testing
    const mockSessionData = {
        sessions: [{
            sessionId: "test@saxadvisorygroup.com_session",
            userEmail: "test@saxadvisorygroup.com",
            conversation: JSON.stringify([
                {
                    role: "user",
                    content: "What is SAX Technology's main focus?",
                    timestamp: "2025-10-17T12:30:00.000Z"
                },
                {
                    role: "assistant", 
                    content: "SAX Technology specializes in comprehensive IT solutions, tax advisory services, and business automation. We help organizations streamline their operations through innovative technology implementations and expert consulting services.",
                    timestamp: "2025-10-17T12:30:03.000Z"
                },
                {
                    role: "user",
                    content: "Tell me about your AI capabilities",
                    timestamp: "2025-10-17T12:31:00.000Z"
                },
                {
                    role: "assistant",
                    content: "Our AI capabilities include document processing, intelligent search, conversation analytics, and automated workflows. The MegaMind platform provides personalized AI assistance for employees and clients.",
                    timestamp: "2025-10-17T12:31:05.000Z"
                }
            ]),
            metadata: {
                department: "IT",
                location: "North Carolina",
                jobTitle: "Developer",
                aiProfile: "sage",
                conversationLength: 4,
                sessionDuration: 65000,
                conversationMetrics: {
                    messageCount: 4,
                    userMessageCount: 2,
                    assistantMessageCount: 2,
                    avgMessageLength: 85
                }
            },
            metrics: {
                totalTokens: 450,
                inputTokens: 200,
                outputTokens: 250,
                modelsUsed: ["gpt-4.1-mini"]
            },
            timestamp: "2025-10-17T12:31:05.000Z"
        }, {
            sessionId: "user2@saxadvisorygroup.com_session", 
            userEmail: "user2@saxadvisorygroup.com",
            conversation: JSON.stringify([
                {
                    role: "user",
                    content: "How do I submit a support ticket?",
                    timestamp: "2025-10-17T11:15:00.000Z"
                },
                {
                    role: "assistant",
                    content: "You can submit a support ticket through our internal portal at support.saxtechnology.com or email support@saxtechnology.com with your issue details.",
                    timestamp: "2025-10-17T11:15:02.000Z"
                }
            ]),
            metadata: {
                department: "Finance", 
                location: "Remote",
                jobTitle: "Analyst",
                aiProfile: "helpful",
                conversationLength: 2,
                sessionDuration: 25000,
                conversationMetrics: {
                    messageCount: 2,
                    userMessageCount: 1, 
                    assistantMessageCount: 1,
                    avgMessageLength: 65
                }
            },
            metrics: {
                totalTokens: 180,
                inputTokens: 80,
                outputTokens: 100,
                modelsUsed: ["gpt-4.1-mini"]
            },
            timestamp: "2025-10-17T11:15:02.000Z"
        }]
    };
    
    // Override fetch for development
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        // Check if this is a conversation logs API call
        if (typeof url === 'string' && url.includes('saxtechconversationlogs.azurewebsites.net')) {
            console.log('[DevOverride] Intercepting API call:', url);
            
            try {
                // Try the original fetch first
                const response = await originalFetch(url, options);
                return response;
            } catch (error) {
                // If CORS blocks it, return mock data
                if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                    console.log('[DevOverride] CORS blocked, returning mock data');
                    
                    return new Response(JSON.stringify(mockSessionData), {
                        status: 200,
                        statusText: 'OK',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
                throw error;
            }
        }
        
        // For all other requests, use original fetch
        return originalFetch(url, options);
    };
    
    // Add development indicator to page
    document.addEventListener('DOMContentLoaded', function() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #f59e0b;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            indicator.textContent = 'DEV MODE';
            indicator.title = 'Development mode with mock data fallbacks';
            document.body.appendChild(indicator);
        }
    });
    
})();