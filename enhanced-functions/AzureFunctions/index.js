/**
 * Azure Functions for SAXTech MegaMind Document Processing
 * These functions handle the advanced document processing pipeline
 */

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const { SearchClient } = require('@azure/search-documents');
const { OpenAIClient } = require('@azure/openai');

// Configuration with REAL Azure resources
const config = {
    storageConnection: process.env.STORAGE_CONNECTION_STRING || 'DefaultEndpointsProtocol=https;AccountName=saxmegamind;AccountKey=sPcHVh2rFyhCk1SclKPaE/8pUXIngDeXPQ6G1XxAnYyYmM3Sf8A1djyIqdYgNZPBwe8CnMSuq3DG+ASt5nuQpg==;EndpointSuffix=core.windows.net',
    searchEndpoint: process.env.SEARCH_ENDPOINT || 'https://saxmegamind-search.search.windows.net',
    searchApiKey: process.env.SEARCH_API_KEY || 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO',
    openAIEndpoint: process.env.OPENAI_ENDPOINT || 'https://saxtechmegamindopenai.openai.azure.com',
    openAIKey: process.env.OPENAI_API_KEY || '5f91bb46df2a4769be8715d063f8757c'
};

/**
 * Semantic Document Processor Function
 * Chunks text and extracts semantic information
 */
module.exports.SemanticDocumentProcessor = async function (context, req) {
    context.log('Semantic processing started');
    
    const { text, config: semanticConfig, metadata } = req.body;
    
    if (!text) {
        context.res = {
            status: 400,
            body: { error: 'No text provided for semantic processing' }
        };
        return;
    }
    
    try {
        // Chunk the text based on configuration
        const chunks = chunkText(text, semanticConfig);
        
        // Extract key phrases and entities for each chunk
        const processedChunks = await Promise.all(chunks.map(async (chunk, index) => {
            const keyPhrases = extractKeyPhrases(chunk.text);
            const entities = extractEntities(chunk.text);
            
            return {
                index: index,
                text: chunk.text,
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                keyPhrases: keyPhrases,
                entities: entities,
                wordCount: chunk.text.split(/\s+/).length
            };
        }));
        
        // Generate summary if requested
        let summary = '';
        if (semanticConfig.generateSummary) {
            summary = generateSummary(text, processedChunks);
        }
        
        // Extract topics
        const topics = extractTopics(processedChunks);
        
        // Analyze sentiment
        const sentiment = analyzeSentiment(text);
        
        context.res = {
            status: 200,
            body: {
                chunks: processedChunks,
                keyPhrases: extractAllKeyPhrases(processedChunks),
                entities: extractAllEntities(processedChunks),
                summary: summary,
                topics: topics,
                sentiment: sentiment,
                totalChunks: processedChunks.length,
                totalWords: text.split(/\s+/).length
            }
        };
        
    } catch (error) {
        context.log.error('Semantic processing error:', error);
        context.res = {
            status: 500,
            body: { error: 'Semantic processing failed', details: error.message }
        };
    }
};

/**
 * Check Duplicate Function
 * Verifies if a document already exists based on hash
 */
module.exports.CheckDuplicate = async function (context, req) {
    context.log('Duplicate check started');
    
    const { fileHash, fileName, client } = req.body;
    
    if (!fileHash) {
        context.res = {
            status: 400,
            body: { error: 'No file hash provided' }
        };
        return;
    }
    
    try {
        // Search for existing document with same hash
        const searchClient = new SearchClient(
            config.searchEndpoint,
            'megamind-documents-v3',
            { apiKey: config.searchApiKey }
        );
        
        const searchResults = await searchClient.search(`fileHash:${fileHash}`, {
            select: ['id', 'fileName', 'uploadDate', 'blobUrl'],
            top: 1
        });
        
        let existingDocument = null;
        for await (const result of searchResults.results) {
            existingDocument = result.document;
            break;
        }
        
        if (existingDocument) {
            context.res = {
                status: 200,
                body: {
                    isDuplicate: true,
                    existingDocument: existingDocument,
                    message: `Document already exists: ${existingDocument.fileName}`
                }
            };
        } else {
            // Store hash for future checks
            await storeFileHash(fileHash, fileName, client);
            
            context.res = {
                status: 200,
                body: {
                    isDuplicate: false,
                    message: 'No duplicate found'
                }
            };
        }
        
    } catch (error) {
        context.log.error('Duplicate check error:', error);
        context.res = {
            status: 500,
            body: { error: 'Duplicate check failed', details: error.message }
        };
    }
};

/**
 * Multi-Location Copy Function
 * Copies documents to multiple storage locations
 */
module.exports.MultiLocationCopy = async function (context, req) {
    context.log('Multi-location copy started');
    
    const { sourceUrl, fileName, department } = req.body;
    
    if (!sourceUrl || !fileName) {
        context.res = {
            status: 400,
            body: { error: 'Source URL and filename required' }
        };
        return;
    }
    
    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(config.storageConnection);
        
        // Define target locations
        const locations = [
            { container: 'documents', path: `${department}/${fileName}` },
            { container: 'documents-backup', path: `backup/${department}/${fileName}` },
            { container: 'documents-archive', path: `archive/${new Date().getFullYear()}/${department}/${fileName}` }
        ];
        
        const copyResults = await Promise.all(locations.map(async (location) => {
            const containerClient = blobServiceClient.getContainerClient(location.container);
            const blobClient = containerClient.getBlobClient(location.path);
            
            // Start copy operation
            const copyPoller = await blobClient.beginCopyFromURL(sourceUrl);
            const result = await copyPoller.pollUntilDone();
            
            return {
                container: location.container,
                path: location.path,
                url: blobClient.url,
                copyStatus: result.copyStatus
            };
        }));
        
        context.res = {
            status: 200,
            body: {
                success: true,
                copies: copyResults,
                message: `Document copied to ${copyResults.length} locations`
            }
        };
        
    } catch (error) {
        context.log.error('Multi-location copy error:', error);
        context.res = {
            status: 500,
            body: { error: 'Multi-location copy failed', details: error.message }
        };
    }
};

/**
 * Convert to JSONL Function
 * Formats document data for Azure Cognitive Search indexing
 */
module.exports.ConvertToJSONL = async function (context, req) {
    context.log('JSONL conversion started');
    
    const documentData = req.body;
    
    if (!documentData || !documentData.id) {
        context.res = {
            status: 400,
            body: { error: 'Invalid document data provided' }
        };
        return;
    }
    
    try {
        const jsonlLines = [];
        
        // Main document entry
        const mainDoc = {
            id: documentData.id,
            fileName: documentData.fileName,
            fileType: documentData.fileType,
            documentType: documentData.documentType,
            uploadDate: documentData.processingDate,
            department: documentData.metadata?.department || 'general',
            title: documentData.metadata?.title || documentData.fileName,
            description: documentData.metadata?.description || '',
            keywords: documentData.metadata?.keywords || '',
            version: documentData.metadata?.version || '1.0',
            blobUrl: documentData.blobUrls?.primary || '',
            blobUrlSecondary: documentData.blobUrls?.secondary || '',
            blobUrlArchive: documentData.blobUrls?.archive || '',
            summary: documentData.semanticData?.summary || '',
            sentiment: documentData.semanticData?.sentiment || 'neutral',
            keyPhrases: documentData.semanticData?.keyPhrases || [],
            entities: documentData.semanticData?.entities || [],
            topics: documentData.semanticData?.topics || [],
            fileHash: documentData.fileHash || '',
            extractedText: documentData.extractedData?.text || '',
            tables: documentData.extractedData?.tables || [],
            pages: documentData.extractedData?.pages || 0,
            language: documentData.extractedData?.language || 'en',
            '@search.action': 'mergeOrUpload'
        };
        
        jsonlLines.push(JSON.stringify(mainDoc));
        
        // Add chunks with vectors
        if (documentData.semanticData?.chunks && documentData.vectors) {
            for (let i = 0; i < documentData.semanticData.chunks.length; i++) {
                const chunk = documentData.semanticData.chunks[i];
                const vector = documentData.vectors[i];
                
                const chunkDoc = {
                    id: `${documentData.id}_chunk_${i}`,
                    parentId: documentData.id,
                    chunkIndex: i,
                    content: chunk.text,
                    contentVector: vector,
                    startOffset: chunk.startOffset,
                    endOffset: chunk.endOffset,
                    keyPhrases: chunk.keyPhrases || [],
                    entities: chunk.entities || [],
                    wordCount: chunk.wordCount || 0,
                    '@search.action': 'mergeOrUpload'
                };
                
                jsonlLines.push(JSON.stringify(chunkDoc));
            }
        }
        
        // Add extracted tables as separate documents
        if (documentData.extractedData?.tables && documentData.extractedData.tables.length > 0) {
            documentData.extractedData.tables.forEach((table, index) => {
                const tableDoc = {
                    id: `${documentData.id}_table_${index}`,
                    parentId: documentData.id,
                    type: 'table',
                    tableIndex: index,
                    rowCount: table.rowCount || 0,
                    columnCount: table.columnCount || 0,
                    headers: table.headers || [],
                    content: JSON.stringify(table.cells || []),
                    '@search.action': 'mergeOrUpload'
                };
                
                jsonlLines.push(JSON.stringify(tableDoc));
            });
        }
        
        context.res = {
            status: 200,
            body: {
                success: true,
                jsonl: jsonlLines.join('\n'),
                documents: jsonlLines.length,
                mainDocumentId: documentData.id
            }
        };
        
    } catch (error) {
        context.log.error('JSONL conversion error:', error);
        context.res = {
            status: 500,
            body: { error: 'JSONL conversion failed', details: error.message }
        };
    }
};

// Helper functions

function chunkText(text, config) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let currentOffset = 0;
    let chunkStartOffset = 0;
    
    for (const sentence of sentences) {
        const sentenceLength = sentence.length;
        
        if (currentChunk.length + sentenceLength > config.chunkSize) {
            if (currentChunk.length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    startOffset: chunkStartOffset,
                    endOffset: currentOffset
                });
                
                // Add overlap
                const overlapText = currentChunk.slice(-config.overlapSize);
                currentChunk = overlapText + sentence;
                chunkStartOffset = currentOffset - overlapText.length;
            } else {
                currentChunk = sentence;
                chunkStartOffset = currentOffset;
            }
        } else {
            currentChunk += sentence;
        }
        
        currentOffset += sentenceLength;
    }
    
    // Add remaining chunk
    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            startOffset: chunkStartOffset,
            endOffset: currentOffset
        });
    }
    
    return chunks;
}

function extractKeyPhrases(text) {
    // Simple key phrase extraction - in production, use Azure Text Analytics
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
        if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
            phrases.push(`${words[i]} ${words[i + 1]}`);
        }
    }
    
    // Return top phrases by frequency
    const phraseCount = {};
    phrases.forEach(phrase => {
        phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });
    
    return Object.entries(phraseCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);
}

function extractEntities(text) {
    // Simple entity extraction - in production, use Azure Text Analytics
    const entities = [];
    
    // Extract email addresses
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emails) {
        emails.forEach(email => entities.push({ type: 'Email', value: email }));
    }
    
    // Extract phone numbers
    const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    if (phones) {
        phones.forEach(phone => entities.push({ type: 'Phone', value: phone }));
    }
    
    // Extract dates
    const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g);
    if (dates) {
        dates.forEach(date => entities.push({ type: 'Date', value: date }));
    }
    
    // Extract money amounts
    const amounts = text.match(/\$[\d,]+\.?\d*/g);
    if (amounts) {
        amounts.forEach(amount => entities.push({ type: 'Money', value: amount }));
    }
    
    return entities;
}

function generateSummary(text, chunks) {
    // Simple extractive summary - take first sentence from top chunks
    const topChunks = chunks
        .sort((a, b) => b.keyPhrases.length - a.keyPhrases.length)
        .slice(0, 3);
    
    const summaryParts = topChunks.map(chunk => {
        const sentences = chunk.text.match(/[^.!?]+[.!?]+/g) || [chunk.text];
        return sentences[0];
    });
    
    return summaryParts.join(' ').substring(0, 500);
}

function extractTopics(chunks) {
    // Extract topics from key phrases across all chunks
    const allPhrases = [];
    chunks.forEach(chunk => {
        allPhrases.push(...(chunk.keyPhrases || []));
    });
    
    const topicCount = {};
    allPhrases.forEach(phrase => {
        topicCount[phrase] = (topicCount[phrase] || 0) + 1;
    });
    
    return Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => ({ topic: entry[0], count: entry[1] }));
}

function analyzeSentiment(text) {
    // Simple sentiment analysis - in production, use Azure Text Analytics
    const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'happy', 'beneficial'];
    const negativeWords = ['bad', 'poor', 'negative', 'failure', 'unhappy', 'problem', 'issue'];
    
    const lowerText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) positiveScore += matches.length;
    });
    
    negativeWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) negativeScore += matches.length;
    });
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
}

function extractAllKeyPhrases(chunks) {
    const allPhrases = new Set();
    chunks.forEach(chunk => {
        (chunk.keyPhrases || []).forEach(phrase => allPhrases.add(phrase));
    });
    return Array.from(allPhrases);
}

function extractAllEntities(chunks) {
    const allEntities = [];
    const seen = new Set();
    
    chunks.forEach(chunk => {
        (chunk.entities || []).forEach(entity => {
            const key = `${entity.type}:${entity.value}`;
            if (!seen.has(key)) {
                seen.add(key);
                allEntities.push(entity);
            }
        });
    });
    
    return allEntities;
}

async function storeFileHash(fileHash, fileName, client) {
    // Store hash in a tracking table or blob storage
    // This is a placeholder - implement based on your storage preference
    const timestamp = new Date().toISOString();
    const hashRecord = {
        hash: fileHash,
        fileName: fileName,
        client: client,
        timestamp: timestamp
    };
    
    // Store in blob storage or table storage
    context.log('Stored file hash:', hashRecord);
    return hashRecord;
}
