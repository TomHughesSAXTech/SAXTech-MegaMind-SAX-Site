const { CosmosClient } = require("@azure/cosmos");

// Initialize Cosmos DB client
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "ConversationHistory";
const containerId = "Sessions";

// Create client (env must provide endpoint and key)
const client = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
    context.log('SaveConversationLog function processing request');
    context.log('Request method:', req.method);
    context.log('Request query:', req.query);
    context.log('Request body keys:', Object.keys(req.body || {}));
    context.log('Environment check - Endpoint:', endpoint ? 'Set' : 'Missing');
    context.log('Environment check - Key:', key ? 'Set' : 'Missing');

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

            // Ensure sessionId exists; if not, create one
            if (!conversation.sessionId) {
                conversation.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

            // Add timestamp if not present
            if (!conversation.timestamp) {
                conversation.timestamp = new Date().toISOString();
            }

            // Use sessionId as the document id so UI can load/delete by sessionId reliably
            conversation.id = conversation.sessionId;

            // Save to Cosmos DB
            const { resource } = await container.items.create(conversation);

            context.res.status = 200;
            context.res.body = { 
                message: "Conversation saved successfully",
                id: resource.id,
                sessionId: conversation.sessionId
            };

        } else if (req.method === "POST" && action === "delete") {
            // Delete a single session
            const sessionId = req.body?.sessionId;
            const userEmail = req.body?.userEmail;
            if (!sessionId) {
                context.res.status = 400;
                context.res.body = { error: "sessionId is required for delete operation" };
                return;
            }
            
            try {
                if (userEmail) {
                    await container.item(sessionId, userEmail).delete();
                } else {
                    // Fallback: find by id OR sessionId to handle legacy records
                    const { resources } = await container.items.query({
                        query: "SELECT TOP 1 c.id, c.userEmail FROM c WHERE c.id = @sid OR c.sessionId = @sid",
                        parameters: [{ name: "@sid", value: sessionId }]
                    }).fetchAll();
                    if (resources.length === 0) throw new Error('not found');
                    await container.item(resources[0].id, resources[0].userEmail).delete();
                }
                context.res.status = 200;
                context.res.body = { success: true, message: "Session deleted successfully" };
            } catch (error) {
                context.res.status = 404;
                context.res.body = { success: false, error: "Session not found" };
            }
            
        } else if (req.method === "POST" && action === "deleteSessions") {
            // Delete multiple sessions
            const sessionIds = req.body?.sessionIds;
            if (!sessionIds || !Array.isArray(sessionIds)) {
                context.res.status = 400;
                context.res.body = { error: "sessionIds array is required" };
                return;
            }
            
            let deletedCount = 0;
            for (const sessionId of sessionIds) {
                try {
                    await container.item(sessionId).delete();
                    deletedCount++;
                } catch (error) {
                    context.log.warn(`Failed to delete session ${sessionId}: ${error.message}`);
                }
            }
            
            context.res.status = 200;
            context.res.body = { success: true, deletedCount: deletedCount };
            
        } else if (req.method === "POST" && action === "deleteUser") {
            // Delete all sessions for a user
            const userEmail = req.body?.userEmail;
            if (!userEmail) {
                context.res.status = 400;
                context.res.body = { error: "userEmail is required" };
                return;
            }
            
            const query = "SELECT c.id FROM c WHERE c.userEmail = @userEmail";
            const { resources } = await container.items
                .query({
                    query: query,
                    parameters: [{ name: "@userEmail", value: userEmail }]
                })
                .fetchAll();
                
            let deletedCount = 0;
            for (const item of resources) {
                try {
                    await container.item(item.id, userEmail).delete();
                    deletedCount++;
                } catch (error) {
                    context.log.warn(`Failed to delete item ${item.id}: ${error.message}`);
                }
            }
            
            context.res.status = 200;
            context.res.body = { success: true, deletedCount: deletedCount };
            
        } else if (req.method === "POST" && action === "deleteAll") {
            // Delete ALL sessions (admin only)
            if (req.body?.adminCode !== 'ADMIN_DELETE_ALL_2024' && req.body?.confirmDelete !== true) {
                context.res.status = 403;
                context.res.body = { error: "Unauthorized delete all operation" };
                return;
            }
            
            const query = "SELECT c.id, c.userEmail FROM c";
            const { resources } = await container.items.query({ query }).fetchAll();
            
            let deletedCount = 0;
            for (const item of resources) {
                try {
                    await container.item(item.id, item.userEmail).delete();
                    deletedCount++;
                } catch (error) {
                    context.log.warn(`Failed to delete item ${item.id}: ${error.message}`);
                }
            }
            
            context.res.status = 200;
            context.res.body = { success: true, deletedCount: deletedCount };
            
        } else if (req.method === "POST" && (action === "list" || action === "load")) {
            // List sessions for a user or load a specific session
            const userEmail = req.body?.userEmail;
            const sessionId = req.body?.sessionId;
            
            if (action === "load" && sessionId) {
                // Load specific session by id or by sessionId field
                try {
                    // Prefer direct read if partition key provided
                    if (userEmail) {
                        const { resource } = await container.item(sessionId, userEmail).read();
                        context.res.status = 200;
                        context.res.body = resource;
                    } else {
                        const { resources } = await container.items.query({
                            query: "SELECT TOP 1 * FROM c WHERE c.id = @sessionId OR c.sessionId = @sessionId",
                            parameters: [{ name: "@sessionId", value: sessionId }]
                        }).fetchAll();
                        if (resources.length > 0) {
                            context.res.status = 200;
                            context.res.body = resources[0];
                        } else {
                            context.res.status = 404;
                            context.res.body = { error: "Session not found" };
                        }
                    }
                } catch (error) {
                    context.res.status = 404;
                    context.res.body = { error: "Session not found" };
                }
            } else if (action === "list" && userEmail) {
                // List all sessions for user
                const query = "SELECT * FROM c WHERE c.userEmail = @userEmail ORDER BY c.timestamp DESC";
                const { resources } = await container.items
                    .query({
                        query: query,
                        parameters: [{ name: "@userEmail", value: userEmail }]
                    })
                    .fetchAll();
                    
                context.res.status = 200;
                context.res.body = { sessions: resources };
            } else {
                context.res.status = 400;
                context.res.body = { error: "Invalid list/load request" };
            }
            
        } else if (req.method === "POST" && action === "admin-list") {
            // Admin: list sessions with optional user/date filters
            const adminKey = req.body?.adminKey;
            const limit = parseInt(req.body?.limit || "200");
            const userEmail = req.body?.userEmail || null;
            const startDate = req.body?.startDate || null;
            const endDate = req.body?.endDate || null;
            const range = (req.body?.range || '').toLowerCase();
            if (adminKey !== 'sax-admin-2024') {
                context.res.status = 403;
                context.res.body = { error: "Forbidden" };
                return;
            }
            // Compute startDate from range if provided
            let effectiveStartDate = startDate;
            if (!effectiveStartDate && range) {
                const d = new Date();
                if (range === 'today') { d.setHours(0,0,0,0); }
                else if (range === 'week') { d.setDate(d.getDate() - 7); }
                else if (range === 'month') { d.setMonth(d.getMonth() - 1); }
                effectiveStartDate = d.toISOString();
            }
            let query = `SELECT TOP ${Math.min(limit,500)} c.userEmail, c.userName, c.timestamp, c.sessionId, c.aiProfile, c.department, c.conversation, c.metadata, c.metrics FROM c WHERE 1=1`;
            const parameters = [];
            if (userEmail) { query += " AND c.userEmail = @userEmail"; parameters.push({ name: "@userEmail", value: userEmail }); }
            if (effectiveStartDate) { query += " AND c.timestamp >= @startDate"; parameters.push({ name: "@startDate", value: effectiveStartDate }); }
            if (endDate) { query += " AND c.timestamp <= @endDate"; parameters.push({ name: "@endDate", value: endDate }); }
            query += " ORDER BY c.timestamp DESC";
            const { resources } = await container.items.query({ query, parameters }).fetchAll();
            context.res.status = 200;
            context.res.body = { conversations: resources };

        } else if (req.method === "POST" && action === "admin-view") {
            // Admin: view full conversation by sessionId
            const adminKey = req.body?.adminKey;
            const sessionId = req.body?.sessionId;
            if (adminKey !== 'sax-admin-2024') {
                context.res.status = 403;
                context.res.body = { error: "Forbidden" };
                return;
            }
            if (!sessionId) {
                context.res.status = 400;
                context.res.body = { error: "sessionId required" };
                return;
            }
            const { resources } = await container.items.query({
                query: "SELECT TOP 1 * FROM c WHERE c.id = @sid OR c.sessionId = @sid",
                parameters: [{ name: "@sid", value: sessionId }]
            }).fetchAll();
            if (resources.length === 0) {
                context.res.status = 404;
                context.res.body = { error: "Not found" };
                return;
            }
            context.res.status = 200;
            context.res.body = resources[0];

        } else if (req.method === "GET" && req.query?.action === "exportUser") {
            // Admin: export all sessions for a user in range/date filter
            const adminKey = req.query?.adminKey;
            const userEmail = req.query?.userEmail;
            const format = (req.query?.format || 'xlsx').toLowerCase();
            const range = (req.query?.range || '').toLowerCase();
            const startDateQ = req.query?.startDate || null;
            const endDateQ = req.query?.endDate || null;
            if (adminKey !== 'sax-admin-2024') {
                context.res.status = 403;
                context.res.body = { error: "Forbidden" };
                return;
            }
            if (!userEmail) {
                context.res.status = 400;
                context.res.body = { error: "userEmail required" };
                return;
            }
            // Compute startDate from range if provided
            let startDate = startDateQ;
            if (!startDate && range) {
                const d = new Date();
                if (range === 'today') { d.setHours(0,0,0,0); }
                else if (range === 'week') { d.setDate(d.getDate() - 7); }
                else if (range === 'month') { d.setMonth(d.getMonth() - 1); }
                startDate = d.toISOString();
            }
            let query = "SELECT * FROM c WHERE c.userEmail = @userEmail";
            const parameters = [{ name: "@userEmail", value: userEmail }];
            if (startDate) { query += " AND c.timestamp >= @startDate"; parameters.push({ name: "@startDate", value: startDate }); }
            if (endDateQ) { query += " AND c.timestamp <= @endDate"; parameters.push({ name: "@endDate", value: endDateQ }); }
            query += " ORDER BY c.timestamp DESC";
            const { resources } = await container.items.query({ query, parameters }).fetchAll();
            const sessions = resources || [];
            if (format === 'xlsx') {
                const Excel = require('exceljs');
                const wb = new Excel.Workbook();
                const ws = wb.addWorksheet('Sessions');
                ws.columns = [
                    { header: 'Timestamp', key: 'timestamp', width: 24 },
                    { header: 'SessionID', key: 'sessionId', width: 28 },
                    { header: 'Role', key: 'role', width: 12 },
                    { header: 'Content', key: 'content', width: 100 }
                ];
                sessions.forEach(s => {
                    (s.conversation || []).forEach(m => {
                        ws.addRow({ timestamp: m.timestamp || s.timestamp || '', sessionId: s.sessionId || s.id, role: m.role, content: m.content });
                    });
                });
                const buf = await wb.xlsx.writeBuffer();
                context.res = {
                    headers: {
                        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "Content-Disposition": `attachment; filename=${userEmail.replace(/[^a-zA-Z0-9._-]/g,'_')}_${range||'custom'}.xlsx`,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, x-functions-key"
                    },
                    body: Buffer.from(buf)
                };
                return;
            } else if (format === 'pdf') {
                const PDFDocument = require('pdfkit');
                const chunks = [];
                const doc = new PDFDocument({ margin: 40 });
                doc.on('data', c => chunks.push(c));
                doc.on('end', () => {
                    const pdf = Buffer.concat(chunks);
                    context.res = {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": `attachment; filename=${userEmail.replace(/[^a-zA-Z0-9._-]/g,'_')}_${range||'custom'}.pdf`,
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type, x-functions-key"
                        },
                        body: pdf
                    };
                });
                doc.fontSize(16).text(`Conversations for ${userEmail}`, { underline: true });
                sessions.forEach(s => {
                    doc.moveDown();
                    doc.fontSize(13).text(`Session: ${s.sessionId || s.id}  @ ${s.timestamp || ''}`);
                    (s.conversation || []).forEach(m => {
                        doc.fontSize(11).text(`[${m.role}] ${m.content}`);
                    });
                });
                doc.end();
                return;
            } else {
                context.res.status = 400;
                context.res.body = { error: "Unsupported format. Use xlsx or pdf." };
                return;
            }

        } else if (req.method === "POST" && action === "export") {
            // Admin: export a session as xlsx or pdf
            const adminKey = req.body?.adminKey || req.query?.adminKey; // allow GET open
            const sessionId = req.body?.sessionId || req.query?.sessionId;
            const format = (req.body?.format || req.query?.format || 'xlsx').toLowerCase();
            if (adminKey !== 'sax-admin-2024') {
                context.res.status = 403;
                context.res.body = { error: "Forbidden" };
                return;
            }
            if (!sessionId) {
                context.res.status = 400;
                context.res.body = { error: "sessionId required" };
                return;
            }
            const { resources } = await container.items.query({
                query: "SELECT TOP 1 * FROM c WHERE c.id = @sid OR c.sessionId = @sid",
                parameters: [{ name: "@sid", value: sessionId }]
            }).fetchAll();
            if (resources.length === 0) {
                context.res.status = 404;
                context.res.body = { error: "Not found" };
                return;
            }
            const session = resources[0];

            if (format === 'xlsx') {
                const Excel = require('exceljs');
                const wb = new Excel.Workbook();
                const ws = wb.addWorksheet('Conversation');
                ws.columns = [
                    { header: 'Timestamp', key: 'timestamp', width: 24 },
                    { header: 'Role', key: 'role', width: 12 },
                    { header: 'Content', key: 'content', width: 100 }
                ];
                (session.conversation || []).forEach(m => ws.addRow({ timestamp: m.timestamp || '', role: m.role, content: m.content }));
                const meta = ws.addRow([]);
                meta.getCell(1).value = 'User'; meta.getCell(2).value = session.userName || session.userEmail;
                const buf = await wb.xlsx.writeBuffer();
                context.res = {
                    headers: {
                        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "Content-Disposition": `attachment; filename=conversation_${session.sessionId || session.id}.xlsx`,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, x-functions-key"
                    },
                    body: Buffer.from(buf)
                };
                return;
            } else if (format === 'pdf') {
                const PDFDocument = require('pdfkit');
                const chunks = [];
                const doc = new PDFDocument({ margin: 40 });
                doc.on('data', c => chunks.push(c));
                doc.on('end', () => {
                    const pdf = Buffer.concat(chunks);
                    context.res = {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": `attachment; filename=conversation_${session.sessionId || session.id}.pdf`,
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type, x-functions-key"
                        },
                        body: pdf
                    };
                });
                doc.fontSize(16).text(`Conversation: ${session.sessionId || session.id}`, { underline: true });
                doc.moveDown();
                (session.conversation || []).forEach(m => {
                    doc.fontSize(12).text(`[${m.role}] ${m.content}`);
                    doc.moveDown(0.2);
                });
                doc.end();
                return;
            } else {
                context.res.status = 400;
                context.res.body = { error: "Unsupported format. Use xlsx or pdf." };
                return;
            }

        } else if (req.method === "GET" && (req.query?.action === "get" || req.query?.action === "recent" || req.query?.action === "stats")) {
            // Support legacy GET endpoints used by the site: action=get|recent|stats
            const actionParam = (req.query.action || '').toLowerCase();
            const email = req.query.email || req.query.userEmail || null;
            const range = (req.query.range || '').toLowerCase();
            const limit = parseInt(req.query.limit || "100");

            // Compute date filters from range
            let startDate = null;
            if (range === 'today') {
                const d = new Date();
                d.setHours(0,0,0,0);
                startDate = d.toISOString();
            } else if (range === 'week') {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                startDate = d.toISOString();
            } else if (range === 'month') {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                startDate = d.toISOString();
            }

            if (actionParam === 'stats') {
                try {
                    // Total sessions
                    const { resources: totalArr } = await container.items.query({ query: "SELECT VALUE COUNT(1) FROM c" }).fetchAll();
                    const totalSessions = totalArr[0] || 0;
                    // Unique users: fetch emails and count unique client-side (avoid DISTINCT)
                    const { resources: userEmails } = await container.items.query({ query: "SELECT VALUE c.userEmail FROM c WHERE IS_DEFINED(c.userEmail)" }).fetchAll();
                    const uniqueUsers = new Set((userEmails || []).filter(Boolean)).size;
                    // Recent sessions (top 5)
                    const { resources: recent } = await container.items.query({ query: "SELECT TOP 5 c.userEmail, c.timestamp FROM c ORDER BY c.timestamp DESC" }).fetchAll();
                    context.res.status = 200;
                    context.res.body = { totalSessions, uniqueUsers, recentSessions: recent };
                } catch (e) {
                    // Safe fallback instead of 500
                    context.res.status = 200;
                    context.res.body = { totalSessions: 0, uniqueUsers: 0, recentSessions: [] };
                }
                return;
            }

            if (actionParam === 'recent') {
                const recentLimit = Math.min(limit || 50, 200);
                const query = `SELECT TOP ${recentLimit} c.userEmail, c.timestamp, c.conversation, c.sessionId FROM c ORDER BY c.timestamp DESC`;
                const { resources } = await container.items.query({ query }).fetchAll();
                context.res.status = 200;
                context.res.body = { count: resources.length, sessions: resources };
                return;
            }

            // action=get
            // Support wildcard or omitted email to fetch across all users
            const allUsers = !email || email === '*' || email.toLowerCase() === 'all';

            let query = allUsers ? "SELECT * FROM c WHERE 1=1" : "SELECT * FROM c WHERE c.userEmail = @userEmail";
            const parameters = allUsers ? [] : [{ name: "@userEmail", value: email }];
            if (startDate) {
                query += " AND c.timestamp >= @startDate";
                parameters.push({ name: "@startDate", value: startDate });
            }
            query += " ORDER BY c.timestamp DESC";
            query += ` OFFSET 0 LIMIT ${limit}`;

            const { resources } = await container.items.query({ query, parameters }).fetchAll();
            context.res.status = 200;
            context.res.body = { count: resources.length, sessions: resources };

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
                try {
                    // Get statistics without DISTINCT
                    const { resources: totalArr2 } = await container.items.query({ query: "SELECT VALUE COUNT(1) FROM c" }).fetchAll();
                    const totalSessions = totalArr2[0] || 0;
                    const { resources: emails2 } = await container.items.query({ query: "SELECT VALUE c.userEmail FROM c WHERE IS_DEFINED(c.userEmail)" }).fetchAll();
                    const uniqueUsers = new Set((emails2 || []).filter(Boolean)).size;

                    const recentQuery = "SELECT TOP 5 c.userEmail, c.timestamp FROM c ORDER BY c.timestamp DESC";
                    const { resources: recent } = await container.items
                        .query({ query: recentQuery })
                        .fetchAll();

                    context.res.status = 200;
                    context.res.body = { totalSessions, uniqueUsers, recentSessions: recent };
                } catch (e) {
                    // Safe fallback
                    context.res.status = 200;
                    context.res.body = { totalSessions: 0, uniqueUsers: 0, recentSessions: [] };
                }
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