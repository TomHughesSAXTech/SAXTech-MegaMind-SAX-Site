const { CosmosClient } = require("@azure/cosmos");

// Cosmos DB configuration
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "https://saxtech-knowledge-graph.documents.azure.com:443/";
const cosmosKey = process.env.COSMOS_KEY || "vOYO9RAZb9jkvnEhAO0LLQvwAqsI7grUj0AiUWRvkJgZlgv5YOmrQCamtPont8Nud1mnvsZ1nAB0ACDbJM0x1A==";
const databaseId = "MegaMindDB";
const containerId = "ConversationLogs";

// Initialize Cosmos client
const cosmosClient = new CosmosClient({ 
    endpoint: cosmosEndpoint, 
    key: cosmosKey 
});

module.exports = async function (context, req) {
    context.log('SaveConversationLog function triggered');

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
    };

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    try {
        // Get or create database
        const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        
        // Get or create container with partition key
        const { container } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ["/userEmail"] }
        });

        const action = req.query.action || req.body?.action || 'save';

        switch (action) {
            case 'save':
                // Save conversation log
                const sessionData = req.body;
                
                if (!sessionData || !sessionData.userEmail) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'User email is required' }
                    };
                    return;
                }

                // Create document with proper structure
                const document = {
                    id: `${sessionData.sessionId || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    userEmail: sessionData.userEmail,
                    userName: sessionData.userName || 'Unknown',
                    sessionId: sessionData.sessionId || `session_${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    conversation: sessionData.conversation || [],
                    metadata: {
                        department: sessionData.department || null,
                        location: sessionData.location || null,
                        messageCount: (sessionData.conversation || []).length,
                        duration: sessionData.duration || null,
                        aiProfile: sessionData.aiProfile || 'default'
                    }
                };

                const { resource: createdItem } = await container.items.create(document);

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        success: true,
                        message: 'Conversation logged successfully',
                        id: createdItem.id
                    }
                };
                break;

            case 'get':
                // Get conversation logs for a user
                const email = req.query.email || req.body?.email;
                const dateRange = req.query.range || req.body?.range || 'week';
                
                if (!email) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'Email is required' }
                    };
                    return;
                }

                // Calculate date filter
                let dateFilter = new Date();
                switch (dateRange) {
                    case 'today':
                        dateFilter.setHours(0, 0, 0, 0);
                        break;
                    case 'week':
                        dateFilter.setDate(dateFilter.getDate() - 7);
                        break;
                    case 'month':
                        dateFilter.setDate(dateFilter.getDate() - 30);
                        break;
                    case 'all':
                        dateFilter = new Date('2000-01-01');
                        break;
                }

                const query = {
                    query: "SELECT * FROM c WHERE c.userEmail = @email AND c.timestamp >= @date ORDER BY c.timestamp DESC",
                    parameters: [
                        { name: "@email", value: email },
                        { name: "@date", value: dateFilter.toISOString() }
                    ]
                };

                const { resources: sessions } = await container.items.query(query).fetchAll();

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        success: true,
                        sessions: sessions,
                        count: sessions.length
                    }
                };
                break;

            case 'recent':
                // Get recent activity across all users
                const limit = parseInt(req.query.limit) || 50;
                
                const recentQuery = {
                    query: "SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit",
                    parameters: [
                        { name: "@limit", value: limit }
                    ]
                };

                const { resources: recentSessions } = await container.items.query(recentQuery).fetchAll();

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        success: true,
                        sessions: recentSessions,
                        count: recentSessions.length
                    }
                };
                break;

            case 'stats':
                // Get statistics
                const statsQuery = {
                    query: "SELECT VALUE COUNT(1) FROM c"
                };
                
                const uniqueUsersQuery = {
                    query: "SELECT DISTINCT VALUE c.userEmail FROM c"
                };

                const { resources: [totalCount] } = await container.items.query(statsQuery).fetchAll();
                const { resources: uniqueUsers } = await container.items.query(uniqueUsersQuery).fetchAll();

                // Calculate more stats
                const last24h = new Date();
                last24h.setDate(last24h.getDate() - 1);
                
                const recentStatsQuery = {
                    query: "SELECT c.metadata.messageCount FROM c WHERE c.timestamp >= @date",
                    parameters: [
                        { name: "@date", value: last24h.toISOString() }
                    ]
                };

                const { resources: recentData } = await container.items.query(recentStatsQuery).fetchAll();
                
                const totalMessages = recentData.reduce((sum, item) => sum + (item.messageCount || 0), 0);
                const avgSessionLength = recentData.length > 0 ? Math.round(totalMessages / recentData.length) : 0;

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        success: true,
                        totalSessions: totalCount || 0,
                        uniqueUsers: uniqueUsers.length,
                        totalMessages: totalMessages,
                        avgSessionLength: avgSessionLength,
                        last24hSessions: recentData.length
                    }
                };
                break;

            case 'search':
                // Search in conversations
                const searchTerm = req.query.query || req.body?.query;
                
                if (!searchTerm) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'Search query is required' }
                    };
                    return;
                }

                const searchQuery = {
                    query: "SELECT c.userEmail, c.timestamp, c.sessionId, ARRAY(SELECT m.content FROM m IN c.conversation WHERE CONTAINS(LOWER(m.content), LOWER(@searchTerm))) as matches FROM c WHERE EXISTS(SELECT VALUE m FROM m IN c.conversation WHERE CONTAINS(LOWER(m.content), LOWER(@searchTerm)))",
                    parameters: [
                        { name: "@searchTerm", value: searchTerm }
                    ]
                };

                const { resources: searchResults } = await container.items.query(searchQuery).fetchAll();

                // Format results with excerpts
                const formattedResults = searchResults.map(result => ({
                    userEmail: result.userEmail,
                    timestamp: result.timestamp,
                    sessionId: result.sessionId,
                    excerpt: result.matches[0] ? result.matches[0].substring(0, 150) + '...' : ''
                }));

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        success: true,
                        matches: formattedResults,
                        count: formattedResults.length
                    }
                };
                break;

            default:
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Invalid action' }
                };
        }

    } catch (error) {
        context.log.error('Error in SaveConversationLog:', error);
        context.res = {
            status: 500,
            headers,
            body: {
                error: 'Failed to process request',
                details: error.message
            }
        };
    }
};