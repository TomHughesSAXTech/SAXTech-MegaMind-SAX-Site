const { CosmosClient } = require("@azure/cosmos");

// Initialize Cosmos DB client
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "ConversationHistory";
const containerId = "Sessions";

const client = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
    context.log('SaveConversationLog function processing request');

    // Enable CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-functions-key"
        }
    };

    // Handle OPTIONS request for CORS preflight
    if (req.method === "OPTIONS") {
        context.res.status = 200;
        return;
    }

    try {
        // Create database and container if they don't exist
        const { database } = await client.databases.createIfNotExists({ id: databaseId });
        const { container } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ["/userEmail"] },
            indexingPolicy: {
                automatic: true,
                includedPaths: [{ path: "/*" }],
                excludedPaths: [{ path: "/\"_etag\"/?" }]
            }
        });

        const action = req.query.action || req.body?.action;

        if (req.method === "POST" && (!action || action === "save")) {
            // Save conversation to Cosmos DB
            const conversation = req.body;
            
            if (!conversation || !conversation.userEmail) {
                context.res.status = 400;
                context.res.body = { error: "Invalid conversation data. userEmail is required." };
                return;
            }

            // Add timestamp if not present
            if (!conversation.timestamp) {
                conversation.timestamp = new Date().toISOString();
            }

            // Generate unique ID
            conversation.id = `${conversation.userEmail}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save to Cosmos DB
            const { resource } = await container.items.create(conversation);

            context.res.status = 200;
            context.res.body = { 
                message: "Conversation saved successfully",
                id: resource.id 
            };

        } else if (req.method === "GET" || (req.method === "POST" && action === "query")) {
            const queryAction = req.query.type || req.body?.type || "list";
            const userEmail = req.query.userEmail || req.body?.userEmail;
            const startDate = req.query.startDate || req.body?.startDate;
            const endDate = req.query.endDate || req.body?.endDate;
            const searchTerm = req.query.searchTerm || req.body?.searchTerm;
            const limit = parseInt(req.query.limit || req.body?.limit || "100");

            let query = "SELECT * FROM c WHERE 1=1";
            const parameters = [];

            // Add filters based on query type
            if (userEmail && queryAction !== "stats" && queryAction !== "recent") {
                query += " AND c.userEmail = @userEmail";
                parameters.push({ name: "@userEmail", value: userEmail });
            }

            if (startDate) {
                query += " AND c.timestamp >= @startDate";
                parameters.push({ name: "@startDate", value: startDate });
            }

            if (endDate) {
                query += " AND c.timestamp <= @endDate";
                parameters.push({ name: "@endDate", value: endDate });
            }

            if (searchTerm && queryAction === "search") {
                query += " AND (CONTAINS(LOWER(c.userMessage), LOWER(@searchTerm)) OR CONTAINS(LOWER(c.assistantMessage), LOWER(@searchTerm)))";
                parameters.push({ name: "@searchTerm", value: searchTerm });
            }

            // Modify query based on action type
            if (queryAction === "stats") {
                // Get statistics
                const statsQuery = "SELECT COUNT(1) as totalSessions, COUNT(DISTINCT c.userEmail) as uniqueUsers FROM c";
                const { resources: stats } = await container.items
                    .query({ query: statsQuery })
                    .fetchAll();

                const recentQuery = "SELECT TOP 5 c.userEmail, c.timestamp FROM c ORDER BY c.timestamp DESC";
                const { resources: recent } = await container.items
                    .query({ query: recentQuery })
                    .fetchAll();

                context.res.status = 200;
                context.res.body = {
                    totalSessions: stats[0]?.totalSessions || 0,
                    uniqueUsers: stats[0]?.uniqueUsers || 0,
                    recentSessions: recent
                };
                return;

            } else if (queryAction === "recent") {
                // Get recent activity
                query = "SELECT TOP 10 c.userEmail, c.timestamp, c.userMessage FROM c ORDER BY c.timestamp DESC";
                parameters.length = 0; // Clear parameters for this specific query
            } else {
                // Regular query - add ordering and limit
                query += " ORDER BY c.timestamp DESC";
                query += ` OFFSET 0 LIMIT ${limit}`;
            }

            // Execute query
            const querySpec = {
                query: query,
                parameters: parameters
            };

            const { resources } = await container.items
                .query(querySpec)
                .fetchAll();

            context.res.status = 200;
            context.res.body = {
                count: resources.length,
                sessions: resources
            };

        } else {
            context.res.status = 400;
            context.res.body = { error: "Invalid request. Use POST to save or GET to query." };
        }

    } catch (error) {
        context.log.error("Error in SaveConversationLog:", error);
        context.res.status = 500;
        context.res.body = { 
            error: "Internal server error", 
            details: error.message 
        };
    }
};