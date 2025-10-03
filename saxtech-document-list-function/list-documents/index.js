const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');

module.exports = async function (context, req) {
    const startTime = Date.now();
    
    try {
        context.log('🚀 Starting fast document list request');
        
        // Get Azure Search credentials from environment
        const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
        const searchKey = process.env.AZURE_SEARCH_KEY;
        const searchIndex = process.env.AZURE_SEARCH_INDEX;
        
        context.log('Environment check:', {
            endpoint: searchEndpoint ? 'SET' : 'MISSING',
            key: searchKey ? 'SET' : 'MISSING', 
            index: searchIndex || 'MISSING',
            allEnv: Object.keys(process.env).filter(k => k.includes('AZURE')).join(', ')
        });
        
        if (!searchEndpoint || !searchKey || !searchIndex) {
            const error = `Missing Azure Search configuration: endpoint=${!!searchEndpoint}, key=${!!searchKey}, index=${!!searchIndex}`;
            context.log.error(error);
            
            // Return error response instead of throwing
            context.res = {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    success: false,
                    error: error,
                    env: {
                        endpoint: searchEndpoint || 'NOT_SET',
                        index: searchIndex || 'NOT_SET',
                        keyExists: !!searchKey
                    }
                }
            };
            return;
        }
        
        // Initialize Azure Search client
        const searchClient = new SearchClient(
            searchEndpoint, 
            searchIndex, 
            new AzureKeyCredential(searchKey)
        );
        
        // Get query parameters
        const department = req.query.department;
        const limit = parseInt(req.query.limit) || 50;
        
        console.log(`📊 Querying Azure Search for up to ${limit} documents${department ? ` in department: ${department}` : ''}`);
        
        // Build search query
        let searchQuery = '*'; // Get all documents
        let filterExpression = null;
        
        if (department && department !== 'all') {
            filterExpression = `department eq '${department.replace(/'/g, "''")}'`;
        }
        
        // Execute search with minimal fields for speed
        const searchResults = await searchClient.search(searchQuery, {
            top: limit,
            filter: filterExpression,
            select: [
                'id',
                'title', 
                'department',
                'blobUrl',
                'fileName',
                'metadata_storage_name',
                'metadata_storage_size',
                'metadata_storage_last_modified',
                'metadata_storage_content_type',
                'metadata_storage_path'
            ],
            includeTotalCount: true
        });
        
        // Process results and deduplicate chunks
        const documents = [];
        const documentMap = new Map();
        let totalCount = 0;
        
        for await (const result of searchResults.results) {
            const doc = result.document;
            
            // Extract file info from blobUrl or metadata
            let fileName = 'Unknown Document';
            let department = doc.department || 'General';
            let blobUrl = doc.blobUrl;
            
            if (blobUrl) {
                try {
                    const url = new URL(blobUrl);
                    const pathParts = url.pathname.split('/').filter(p => p);
                    if (pathParts.length > 1) {
                        const filePath = pathParts.slice(1).join('/');
                        fileName = filePath.includes('%') ? decodeURIComponent(filePath) : filePath;
                        if (!doc.department && fileName.includes('/')) {
                            department = fileName.split('/')[0];
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse blobUrl:', blobUrl);
                }
            } else {
                fileName = doc.fileName || doc.metadata_storage_name || doc.title || doc.id;
            }
            
            // Extract display name (just filename)
            const displayName = fileName.split('/').pop();
            
            // Parse file size
            let size = 0;
            if (doc.metadata_storage_size) {
                size = parseInt(doc.metadata_storage_size) || 0;
            }
            
            // Parse last modified date
            let lastModified = null;
            const dateFields = ['metadata_storage_last_modified'];
            for (const field of dateFields) {
                if (doc[field]) {
                    try {
                        const testDate = new Date(doc[field]);
                        if (testDate && isFinite(testDate.getTime()) && testDate.getTime() > 0) {
                            lastModified = doc[field];
                            break;
                        }
                    } catch (e) {
                        console.warn(`Invalid date in ${field}:`, doc[field]);
                    }
                }
            }
            
            // Create document object
            const documentObj = {
                id: doc.id,
                title: doc.title || displayName,
                fileName: fileName,
                displayName: displayName,
                size: size,
                lastModified: lastModified,
                contentType: doc.metadata_storage_content_type || 'application/pdf',
                department: department,
                url: blobUrl,
                indexed: true
            };
            
            // Deduplicate by department + displayName
            const dedupeKey = `${department}/${displayName}`;
            const existing = documentMap.get(dedupeKey);
            
            if (!existing) {
                documentMap.set(dedupeKey, documentObj);
            } else {
                // Keep the most recent modified time
                const existingTime = existing.lastModified ? new Date(existing.lastModified).getTime() : 0;
                const currentTime = documentObj.lastModified ? new Date(documentObj.lastModified).getTime() : 0;
                
                if (currentTime > existingTime) {
                    existing.lastModified = documentObj.lastModified;
                    existing.url = documentObj.url;
                }
                
                // Prefer non-zero size
                if (!existing.size && documentObj.size) {
                    existing.size = documentObj.size;
                }
            }
        }
        
        // Convert map to array
        const uniqueDocuments = Array.from(documentMap.values());
        
        // Get total count from search results
        if (searchResults.count !== undefined) {
            totalCount = searchResults.count;
        }
        
        // Calculate last modified for all documents
        let lastModifiedGlobal = null;
        const allDates = uniqueDocuments
            .map(d => d.lastModified)
            .filter(Boolean)
            .map(d => {
                try {
                    const date = new Date(d);
                    return isFinite(date.getTime()) ? date.getTime() : null;
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean);
            
        if (allDates.length > 0) {
            const maxTime = Math.max(...allDates);
            lastModifiedGlobal = new Date(maxTime).toISOString();
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Document list completed in ${duration}ms: ${uniqueDocuments.length} unique documents from ${totalCount} total chunks`);
        
        // Return response
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: {
                success: true,
                documents: uniqueDocuments,
                totalChunks: totalCount,
                uniqueDocuments: uniqueDocuments.length,
                lastModified: lastModifiedGlobal,
                executionTime: duration,
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.error('❌ Error in document list:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: false,
                error: error.message,
                executionTime: duration,
                timestamp: new Date().toISOString()
            }
        };
    }
};