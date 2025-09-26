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

                // Create document with enhanced metrics structure
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
                        aiProfile: sessionData.aiProfile || 'default',
                        sessionStartTime: sessionData.sessionStartTime || null,
                        sessionEndTime: sessionData.sessionEndTime || null
                    },
                    metrics: {
                        // Model usage metrics
                        modelsUsed: sessionData.modelsUsed || [],
                        modelSwitches: sessionData.modelSwitches || 0,
                        
                        // Token usage metrics
                        totalTokens: sessionData.totalTokens || 0,
                        inputTokens: sessionData.inputTokens || 0,
                        outputTokens: sessionData.outputTokens || 0,
                        tokensByModel: sessionData.tokensByModel || {},
                        
                        // Tool and index usage
                        toolsUsed: sessionData.toolsUsed || [],
                        indexQueries: sessionData.indexQueries || 0,
                        documentsRetrieved: sessionData.documentsRetrieved || 0,
                        searchQueries: sessionData.searchQueries || [],
                        
                        // Voice agent metrics
                        voiceAgentUsed: sessionData.voiceAgentUsed || false,
                        voiceAgentName: sessionData.voiceAgentName || null,
                        voiceDuration: sessionData.voiceDuration || 0,
                        voiceInterruptions: sessionData.voiceInterruptions || 0,
                        
                        // Performance metrics
                        avgResponseTime: sessionData.avgResponseTime || null,
                        confidenceScores: sessionData.confidenceScores || [],
                        avgConfidence: sessionData.avgConfidence || null,
                        
                        // User interaction metrics
                        userFeedback: sessionData.userFeedback || [],
                        regenerations: sessionData.regenerations || 0,
                        attachments: sessionData.attachments || [],
                        errorCount: sessionData.errorCount || 0
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

            // === Deletion Operations ===
            case 'delete': {
                // Delete a single session by id or sessionId
                const id = req.query.id || req.body?.id;
                const sessionId = req.query.sessionId || req.body?.sessionId;
                let userEmail = req.query.userEmail || req.body?.userEmail;

                try {
                    if (id) {
                        if (!userEmail) {
                            // Find the partition key for this id
                            const q = {
                                query: "SELECT c.id, c.userEmail FROM c WHERE c.id = @id",
                                parameters: [ { name: "@id", value: id } ]
                            };
                            const { resources } = await container.items.query(q).fetchAll();
                            if (resources.length === 0) throw new Error('Item not found');
                            userEmail = resources[0].userEmail;
                        }
                        await container.item(id, userEmail).delete();
                        context.res = { status: 200, headers, body: { success: true, deletedCount: 1 } };
                        break;
                    }

                    if (!sessionId) {
                        context.res = { status: 400, headers, body: { error: 'id or sessionId required' } };
                        break;
                    }
                    const findBySession = {
                        query: "SELECT c.id, c.userEmail FROM c WHERE c.sessionId = @sid",
                        parameters: [ { name: "@sid", value: sessionId } ]
                    };
                    const { resources } = await container.items.query(findBySession).fetchAll();
                    let count = 0;
                    for (const r of resources) {
                        await container.item(r.id, r.userEmail).delete();
                        count++;
                    }
                    context.res = { status: 200, headers, body: { success: true, deletedCount: count } };
                } catch (e) {
                    context.res = { status: 500, headers, body: { error: 'Delete failed', details: e.message } };
                }
                break;
            }

            case 'deleteSessions': {
                // Delete multiple by array of sessionIds or ids
                const ids = req.body?.ids || [];
                const sessionIds = req.body?.sessionIds || [];
                if ((!Array.isArray(ids) || ids.length === 0) && (!Array.isArray(sessionIds) || sessionIds.length === 0)) {
                    context.res = { status: 400, headers, body: { error: 'Provide ids[] or sessionIds[]' } };
                    break;
                }
                let total = 0;
                try {
                    if (ids.length > 0) {
                        for (const entry of ids) {
                            const id = typeof entry === 'string' ? entry : entry.id;
                            let pk = typeof entry === 'object' ? entry.userEmail : null;
                            if (!pk) {
                                const q = { query: "SELECT c.id, c.userEmail FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] };
                                const { resources } = await container.items.query(q).fetchAll();
                                if (resources.length) pk = resources[0].userEmail;
                            }
                            if (id && pk) { await container.item(id, pk).delete(); total++; }
                        }
                    }
                    if (sessionIds.length > 0) {
                        for (const sid of sessionIds) {
                            const q = { query: "SELECT c.id, c.userEmail FROM c WHERE c.sessionId = @sid", parameters: [{ name: "@sid", value: sid }] };
                            const { resources } = await container.items.query(q).fetchAll();
                            for (const r of resources) { await container.item(r.id, r.userEmail).delete(); total++; }
                        }
                    }
                    context.res = { status: 200, headers, body: { success: true, deletedCount: total } };
                } catch (e) {
                    context.res = { status: 500, headers, body: { error: 'Bulk delete failed', details: e.message } };
                }
                break;
            }

            case 'deleteUser': {
                const userEmail = req.query.userEmail || req.body?.userEmail;
                if (!userEmail) { context.res = { status: 400, headers, body: { error: 'userEmail required' } }; break; }
                try {
                    const q = { query: "SELECT c.id, c.userEmail FROM c WHERE c.userEmail = @u", parameters: [{ name: "@u", value: userEmail }] };
                    const { resources } = await container.items.query(q).fetchAll();
                    let count = 0;
                    for (const r of resources) { await container.item(r.id, r.userEmail).delete(); count++; }
                    context.res = { status: 200, headers, body: { success: true, deletedCount: count } };
                } catch (e) {
                    context.res = { status: 500, headers, body: { error: 'Delete user failed', details: e.message } };
                }
                break;
            }

            case 'deleteAll':
            case 'deleteAllGlobal': {
                const confirm = req.body?.confirmDelete || req.body?.confirm || req.query.confirm === 'true';
                if (!confirm) { context.res = { status: 400, headers, body: { error: 'Confirmation required' } }; break; }
                try {
                    const q = { query: "SELECT c.id, c.userEmail FROM c" };
                    const { resources } = await container.items.query(q).fetchAll();
                    let count = 0;
                    for (const r of resources) { await container.item(r.id, r.userEmail).delete(); count++; }
                    context.res = { status: 200, headers, body: { success: true, deletedCount: count } };
                } catch (e) {
                    context.res = { status: 500, headers, body: { error: 'Delete all failed', details: e.message } };
                }
                break;
            }

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