/**
 * SAXTech MegaMind Advanced Document Processor
 * Complete document processing pipeline with all AI capabilities
 * Version: 3.0.0
 * 
 * Features:
 * - Semantic configuration and chunking
 * - Vectorization with Azure OpenAI embeddings
 * - Document Intelligence for structured data extraction
 * - Computer Vision for images and scanned PDFs
 * - Deduplication with hash-based detection
 * - Copy operations for multi-location storage
 * - JSONL formatting for Azure Cognitive Search
 */

class MegaMindDocumentProcessor {
    constructor() {
        this.config = {
            // Azure Function Apps - REAL RESOURCES
            azureFunctions: {
                baseUrl: 'https://saxtechmegamindfunctions.azurewebsites.net/api',
                functionKey: 'zM5jG96cEf8xys3BptLRhgMoKAh9Ots6avbBOLuTGhSrAzFuxCpucw==',
                endpoints: {
                    documentIntelligence: '/DocumentIntelligence',
                    computerVision: '/ComputerVisionOCR',
                    semanticProcessor: '/SemanticDocumentProcessor',
                    vectorizer: '/GenerateEmbeddings',
                    jsonlConverter: '/ConvertToJSONL',
                    deduplicator: '/CheckDuplicate',
                    multiCopy: '/MultiLocationCopy'
                }
            },
            
            // Azure OpenAI for embeddings - REAL
            azureOpenAI: {
                endpoint: 'https://saxtechmegamindopenai.openai.azure.com',
                apiKey: '5f91bb46df2a4769be8715d063f8757c',
                deploymentName: 'text-embedding-ada-002',
                apiVersion: '2024-02-15-preview'
            },
            
            // Azure Cognitive Search - REAL
            searchService: {
                endpoint: 'https://saxmegamind-search.search.windows.net',
                apiKey: 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO',
                indexes: {
                    documents: 'megamind-documents-v3',
                    vectors: 'megamind-vectors-v3',
                    semantic: 'megamind-semantic-v3'
                },
                apiVersion: '2023-11-01'
            },
            
            // Azure Blob Storage - REAL ACCOUNTS
            blobStorage: {
                primary: {
                    account: 'saxmegamind',
                    container: 'documents',
                    sasToken: '?sp=racwdl&st=2025-01-01T00:00:00Z&se=2030-12-31T23:59:59Z&spr=https&sv=2024-11-04&sr=c&sig=' + encodeURIComponent('sPcHVh2rFyhCk1SclKPaE/8pUXIngDeXPQ6G1XxAnYyYmM3Sf8A1djyIqdYgNZPBwe8CnMSuq3DG+ASt5nuQpg==')
                },
                secondary: {
                    account: 'saxtechbackups',
                    container: 'documents-backup',
                    sasToken: '?sp=racwdl&st=2025-01-01T00:00:00Z&se=2030-12-31T23:59:59Z&spr=https&sv=2024-11-04&sr=c&sig=' + encodeURIComponent('sPcHVh2rFyhCk1SclKPaE/8pUXIngDeXPQ6G1XxAnYyYmM3Sf8A1djyIqdYgNZPBwe8CnMSuq3DG+ASt5nuQpg==')
                },
                archive: {
                    account: 'saxtechn8nbackups',
                    container: 'documents-archive',
                    sasToken: '?sp=racwdl&st=2025-01-01T00:00:00Z&se=2030-12-31T23:59:59Z&spr=https&sv=2024-11-04&sr=c&sig=' + encodeURIComponent('sPcHVh2rFyhCk1SclKPaE/8pUXIngDeXPQ6G1XxAnYyYmM3Sf8A1djyIqdYgNZPBwe8CnMSuq3DG+ASt5nuQpg==')
                }
            },
            
            // Document Intelligence configuration - REAL
            documentIntelligence: {
                endpoint: 'https://saxmegamind-docintel.cognitiveservices.azure.com',
                apiKey: 'a657a34443a849fa95691fcf6aafc47d',
                apiVersion: '2023-10-31-preview',
                models: {
                    invoice: 'prebuilt-invoice',
                    receipt: 'prebuilt-receipt',
                    idDocument: 'prebuilt-idDocument',
                    businessCard: 'prebuilt-businessCard',
                    layout: 'prebuilt-layout',
                    general: 'prebuilt-document',
                    custom: 'megamind-custom-v2'
                }
            },
            
            // Computer Vision configuration - REAL
            computerVision: {
                endpoint: 'https://saxmegamind-vision.cognitiveservices.azure.com',
                apiKey: '2df20439f0ac46ac857e3ed6e71ac5bc',
                apiVersion: '2023-10-01',
                features: ['Read', 'OCR', 'ImageAnalysis', 'ObjectDetection']
            },
            
            // Semantic configuration
            semanticConfig: {
                chunkSize: 1000, // tokens per chunk
                overlapSize: 100, // overlap between chunks
                minChunkSize: 200,
                maxChunkSize: 2000,
                semanticModel: 'gpt-4-turbo',
                extractKeyPhrases: true,
                extractEntities: true,
                generateSummary: true
            },
            
            // n8n webhook endpoints
            n8nWebhooks: {
                baseUrl: 'https://workflows.saxtechnology.com/webhook',
                endpoints: {
                    process: '/megamind/process-document',
                    status: '/megamind/status',
                    complete: '/megamind/complete',
                    error: '/megamind/error'
                }
            }
        };
        
        this.processingQueue = [];
        this.deduplicationCache = new Map();
    }
    
    /**
     * Main processing pipeline
     */
    async processDocument(file, metadata = {}) {
        const processingId = this.generateProcessingId();
        
        try {
            console.log(`Starting advanced processing for: ${file.name}`);
            
            // Step 1: Deduplication check
            const isDuplicate = await this.checkDuplicate(file, metadata);
            if (isDuplicate && metadata.skipDuplicates) {
                return {
                    success: false,
                    message: 'Duplicate document detected',
                    existingDocument: isDuplicate
                };
            }
            
            // Step 2: Initial file processing and upload to blob
            const blobUrls = await this.uploadToMultipleLocations(file, metadata);
            
            // Step 3: Determine document type and apply appropriate processing
            const documentType = await this.analyzeDocumentType(file);
            
            // Step 4: Apply Document Intelligence or Computer Vision based on type
            let extractedData = {};
            
            if (this.requiresOCR(file, documentType)) {
                extractedData = await this.processWithComputerVision(file, blobUrls.primary);
            }
            
            if (this.requiresDocumentIntelligence(documentType)) {
                const diData = await this.processWithDocumentIntelligence(file, blobUrls.primary, documentType);
                extractedData = { ...extractedData, ...diData };
            }
            
            // Step 5: Semantic processing and chunking
            const semanticData = await this.processSemantics(extractedData.text || '', metadata);
            
            // Step 6: Generate embeddings for each chunk
            const vectors = await this.generateEmbeddings(semanticData.chunks);
            
            // Step 7: Convert to JSONL format for indexing
            const jsonlData = await this.convertToJSONL({
                id: processingId,
                fileName: file.name,
                fileType: file.type,
                documentType: documentType,
                metadata: metadata,
                extractedData: extractedData,
                semanticData: semanticData,
                vectors: vectors,
                blobUrls: blobUrls,
                processingDate: new Date().toISOString()
            });
            
            // Step 8: Update all search indexes
            await this.updateSearchIndexes(jsonlData);
            
            // Step 9: Send completion webhook
            await this.sendCompletionWebhook({
                processingId: processingId,
                fileName: file.name,
                success: true,
                blobUrls: blobUrls,
                indexData: jsonlData
            });
            
            return {
                success: true,
                processingId: processingId,
                fileName: file.name,
                documentType: documentType,
                blobUrls: blobUrls,
                extractedData: extractedData,
                semanticChunks: semanticData.chunks.length,
                vectorsGenerated: vectors.length,
                indexed: true,
                message: 'Document processed successfully with all AI capabilities'
            };
            
        } catch (error) {
            console.error('Processing error:', error);
            await this.sendErrorWebhook(processingId, error);
            throw error;
        }
    }
    
    /**
     * Check for duplicate documents using hash comparison
     */
    async checkDuplicate(file, metadata) {
        const fileHash = await this.calculateFileHash(file);
        
        // Check local cache first
        if (this.deduplicationCache.has(fileHash)) {
            return this.deduplicationCache.get(fileHash);
        }
        
        // Check Azure Function for existing documents
        const response = await fetch(
            `${this.config.azureFunctions.baseUrl}${this.config.azureFunctions.endpoints.deduplicator}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': this.config.azureFunctions.functionKey
                },
                body: JSON.stringify({
                    fileHash: fileHash,
                    fileName: file.name,
                    client: metadata.department || 'general'
                })
            }
        );
        
        if (response.ok) {
            const result = await response.json();
            if (result.isDuplicate) {
                this.deduplicationCache.set(fileHash, result.existingDocument);
                return result.existingDocument;
            }
        }
        
        return null;
    }
    
    /**
     * Upload document to multiple storage locations
     */
    async uploadToMultipleLocations(file, metadata) {
        const base64Data = await this.fileToBase64(file);
        const fileName = this.sanitizeFileName(file.name);
        const timestamp = Date.now();
        
        const uploads = await Promise.all([
            // Primary storage
            this.uploadToBlob(
                this.config.blobStorage.primary,
                `${metadata.department || 'general'}/${timestamp}_${fileName}`,
                base64Data,
                file.type
            ),
            
            // Secondary backup
            this.uploadToBlob(
                this.config.blobStorage.secondary,
                `backup/${metadata.department || 'general'}/${timestamp}_${fileName}`,
                base64Data,
                file.type
            ),
            
            // Archive storage
            this.uploadToBlob(
                this.config.blobStorage.archive,
                `archive/${new Date().getFullYear()}/${metadata.department || 'general'}/${fileName}`,
                base64Data,
                file.type
            )
        ]);
        
        return {
            primary: uploads[0],
            secondary: uploads[1],
            archive: uploads[2]
        };
    }
    
    /**
     * Process document with Computer Vision OCR
     */
    async processWithComputerVision(file, blobUrl) {
        const response = await fetch(
            `${this.config.computerVision.endpoint}/vision/v${this.config.computerVision.apiVersion}/read/analyze`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.computerVision.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: blobUrl })
            }
        );
        
        if (!response.ok) {
            throw new Error('Computer Vision processing failed');
        }
        
        // Get operation location for async processing
        const operationLocation = response.headers.get('Operation-Location');
        
        // Poll for results
        let result = null;
        let attempts = 0;
        while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const statusResponse = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.computerVision.apiKey
                }
            });
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
                result = status.analyzeResult;
                break;
            } else if (status.status === 'failed') {
                throw new Error('OCR processing failed');
            }
            
            attempts++;
        }
        
        // Extract text from pages
        let fullText = '';
        if (result && result.readResults) {
            for (const page of result.readResults) {
                for (const line of page.lines) {
                    fullText += line.text + '\n';
                }
            }
        }
        
        return {
            text: fullText,
            pages: result?.readResults?.length || 0,
            language: result?.language || 'en'
        };
    }
    
    /**
     * Process document with Document Intelligence
     */
    async processWithDocumentIntelligence(file, blobUrl, documentType) {
        const model = this.getDocumentIntelligenceModel(documentType);
        
        const response = await fetch(
            `${this.config.documentIntelligence.endpoint}/formrecognizer/documentModels/${model}:analyze?api-version=${this.config.documentIntelligence.apiVersion}`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.documentIntelligence.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ urlSource: blobUrl })
            }
        );
        
        if (!response.ok) {
            throw new Error('Document Intelligence processing failed');
        }
        
        const operationLocation = response.headers.get('Operation-Location');
        
        // Poll for results
        let result = null;
        let attempts = 0;
        while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const statusResponse = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.documentIntelligence.apiKey
                }
            });
            
            const status = await statusResponse.json();
            
            if (status.status === 'succeeded') {
                result = status.analyzeResult;
                break;
            } else if (status.status === 'failed') {
                throw new Error('Document analysis failed');
            }
            
            attempts++;
        }
        
        // Extract structured data
        const extractedData = {
            text: result?.content || '',
            tables: result?.tables || [],
            keyValuePairs: result?.keyValuePairs || [],
            entities: result?.entities || [],
            styles: result?.styles || [],
            pages: result?.pages?.length || 0
        };
        
        // Extract specific fields based on document type
        if (result?.documents && result.documents.length > 0) {
            extractedData.fields = result.documents[0].fields || {};
        }
        
        return extractedData;
    }
    
    /**
     * Semantic processing with chunking and analysis
     */
    async processSemantics(text, metadata) {
        const response = await fetch(
            `${this.config.azureFunctions.baseUrl}${this.config.azureFunctions.endpoints.semanticProcessor}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': this.config.azureFunctions.functionKey
                },
                body: JSON.stringify({
                    text: text,
                    config: this.config.semanticConfig,
                    metadata: metadata
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Semantic processing failed');
        }
        
        const result = await response.json();
        
        return {
            chunks: result.chunks || [],
            keyPhrases: result.keyPhrases || [],
            entities: result.entities || [],
            summary: result.summary || '',
            topics: result.topics || [],
            sentiment: result.sentiment || 'neutral'
        };
    }
    
    /**
     * Generate embeddings for text chunks
     */
    async generateEmbeddings(chunks) {
        const embeddings = [];
        
        // Process in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            
            const batchEmbeddings = await Promise.all(
                batch.map(chunk => this.generateSingleEmbedding(chunk.text))
            );
            
            embeddings.push(...batchEmbeddings);
            
            // Rate limiting
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return embeddings;
    }
    
    /**
     * Generate embedding for a single text chunk
     */
    async generateSingleEmbedding(text) {
        const response = await fetch(
            `${this.config.azureOpenAI.endpoint}/openai/deployments/${this.config.azureOpenAI.deploymentName}/embeddings?api-version=${this.config.azureOpenAI.apiVersion}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.config.azureOpenAI.apiKey
                },
                body: JSON.stringify({
                    input: text,
                    model: 'text-embedding-ada-002'
                })
            }
        );
        
        if (!response.ok) {
            console.error('Embedding generation failed');
            return null;
        }
        
        const result = await response.json();
        return result.data[0].embedding;
    }
    
    /**
     * Convert document data to JSONL format
     */
    async convertToJSONL(documentData) {
        const jsonlLines = [];
        
        // Main document entry
        jsonlLines.push(JSON.stringify({
            id: documentData.id,
            fileName: documentData.fileName,
            fileType: documentData.fileType,
            documentType: documentData.documentType,
            uploadDate: documentData.processingDate,
            department: documentData.metadata.department || 'general',
            title: documentData.metadata.title || documentData.fileName,
            description: documentData.metadata.description || '',
            keywords: documentData.metadata.keywords || '',
            blobUrl: documentData.blobUrls.primary,
            summary: documentData.semanticData.summary || '',
            sentiment: documentData.semanticData.sentiment || 'neutral',
            '@search.action': 'mergeOrUpload'
        }));
        
        // Add chunks as separate entries
        for (let i = 0; i < documentData.semanticData.chunks.length; i++) {
            const chunk = documentData.semanticData.chunks[i];
            const vector = documentData.vectors[i];
            
            jsonlLines.push(JSON.stringify({
                id: `${documentData.id}_chunk_${i}`,
                parentId: documentData.id,
                chunkIndex: i,
                content: chunk.text,
                contentVector: vector,
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                keyPhrases: chunk.keyPhrases || [],
                entities: chunk.entities || [],
                '@search.action': 'mergeOrUpload'
            }));
        }
        
        return jsonlLines;
    }
    
    /**
     * Update all search indexes
     */
    async updateSearchIndexes(jsonlData) {
        // Update main document index
        await this.updateSearchIndex(
            this.config.searchService.indexes.documents,
            jsonlData.filter(line => !line.includes('_chunk_'))
        );
        
        // Update vector index
        await this.updateSearchIndex(
            this.config.searchService.indexes.vectors,
            jsonlData.filter(line => line.includes('_chunk_'))
        );
        
        // Update semantic index
        await this.updateSearchIndex(
            this.config.searchService.indexes.semantic,
            jsonlData
        );
    }
    
    /**
     * Update a specific search index
     */
    async updateSearchIndex(indexName, data) {
        const batch = {
            value: data.map(line => JSON.parse(line))
        };
        
        const response = await fetch(
            `${this.config.searchService.endpoint}/indexes/${indexName}/docs/index?api-version=${this.config.searchService.apiVersion}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.config.searchService.apiKey
                },
                body: JSON.stringify(batch)
            }
        );
        
        if (!response.ok) {
            console.error(`Failed to update index ${indexName}`);
            throw new Error(`Search index update failed: ${indexName}`);
        }
        
        return await response.json();
    }
    
    /**
     * Helper functions
     */
    
    async uploadToBlob(storageConfig, blobName, base64Data, contentType) {
        const binaryData = this.base64ToArrayBuffer(base64Data);
        const url = `https://${storageConfig.account}.blob.core.windows.net/${storageConfig.container}/${blobName}${storageConfig.sasToken}`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': contentType || 'application/octet-stream'
            },
            body: binaryData
        });
        
        if (!response.ok) {
            throw new Error(`Blob upload failed: ${response.status}`);
        }
        
        return url.split('?')[0]; // Return URL without SAS token
    }
    
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    }
    
    async calculateFileHash(file) {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
    
    sanitizeFileName(fileName) {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    }
    
    generateProcessingId() {
        return `megamind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    analyzeDocumentType(file) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type?.toLowerCase() || '';
        
        if (fileName.includes('invoice') || fileName.includes('bill')) {
            return 'invoice';
        }
        if (fileName.includes('receipt')) {
            return 'receipt';
        }
        if (fileName.includes('contract') || fileName.includes('agreement')) {
            return 'contract';
        }
        if (fileName.includes('report')) {
            return 'report';
        }
        if (fileType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            return 'spreadsheet';
        }
        if (fileType.includes('presentation') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            return 'presentation';
        }
        if (fileType.includes('image')) {
            return 'image';
        }
        
        return 'general';
    }
    
    requiresOCR(file, documentType) {
        const ocrTypes = ['image', 'scanned-pdf'];
        const ocrExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'];
        
        return ocrTypes.includes(documentType) || 
               ocrExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) ||
               (file.type === 'application/pdf' && file.size < 100000); // Small PDFs might be scanned
    }
    
    requiresDocumentIntelligence(documentType) {
        const diTypes = ['invoice', 'receipt', 'contract', 'form', 'report', 'general'];
        return diTypes.includes(documentType);
    }
    
    getDocumentIntelligenceModel(documentType) {
        const modelMap = {
            'invoice': this.config.documentIntelligence.models.invoice,
            'receipt': this.config.documentIntelligence.models.receipt,
            'contract': this.config.documentIntelligence.models.custom,
            'form': this.config.documentIntelligence.models.custom,
            'report': this.config.documentIntelligence.models.layout,
            'general': this.config.documentIntelligence.models.general
        };
        
        return modelMap[documentType] || this.config.documentIntelligence.models.general;
    }
    
    async sendCompletionWebhook(data) {
        try {
            await fetch(`${this.config.n8nWebhooks.baseUrl}${this.config.n8nWebhooks.endpoints.complete}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Webhook notification failed:', error);
        }
    }
    
    async sendErrorWebhook(processingId, error) {
        try {
            await fetch(`${this.config.n8nWebhooks.baseUrl}${this.config.n8nWebhooks.endpoints.error}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    processingId: processingId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (webhookError) {
            console.error('Error webhook failed:', webhookError);
        }
    }
}

// Initialize and export
window.MegaMindProcessor = new MegaMindDocumentProcessor();

// Override existing upload function to use advanced processor
window.uploadDocument = async function(formData) {
    const processor = window.MegaMindProcessor;
    
    const file = formData.get('file');
    const metadata = {
        department: formData.get('department'),
        sopType: formData.get('sopType'),
        documentType: formData.get('documentType') || formData.get('sopType'),
        updateType: formData.get('updateType'),
        title: formData.get('title'),
        description: formData.get('description'),
        keywords: formData.get('keywords'),
        version: formData.get('version'),
        existingDocId: formData.get('existingDocId'),
        uploadedBy: formData.get('uploadedBy') || 'SAX Portal User',
        skipDuplicates: formData.get('skipDuplicates') !== 'false'
    };
    
    return await processor.processDocument(file, metadata);
};

console.log('✅ MegaMind Advanced Document Processor initialized with all AI capabilities');
