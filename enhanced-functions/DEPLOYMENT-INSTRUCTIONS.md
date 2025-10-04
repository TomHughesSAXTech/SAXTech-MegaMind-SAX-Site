# SAXTech MegaMind Advanced Document Processor - Deployment Instructions

## Overview
This is a complete document processing solution that includes:
- ✅ **Semantic configuration and chunking** - Intelligent text segmentation
- ✅ **Vectorization** - Azure OpenAI embeddings for similarity search
- ✅ **Document Intelligence** - Structured data extraction from PDFs, Word, Excel
- ✅ **Computer Vision** - OCR for scanned documents and images
- ✅ **Deduplication** - SHA-256 hash-based duplicate detection
- ✅ **Multi-location copy** - Redundant storage across primary, backup, and archive
- ✅ **JSONL formatting** - Optimized for Azure Cognitive Search indexing

## Components

### 1. Client-Side Processor (`megamind-advanced-processor.js`)
- Full document processing pipeline
- Direct integration with Azure services
- Handles all file types (PDF, Word, Excel, Images)
- Automatic OCR detection for scanned documents
- Multi-stage processing with error recovery

### 2. Azure Functions (`AzureFunctions/index.js`)
- `SemanticDocumentProcessor` - Text chunking and semantic analysis
- `CheckDuplicate` - Hash-based deduplication
- `MultiLocationCopy` - Redundant storage operations
- `ConvertToJSONL` - Search index formatting

## Deployment Steps

### Step 1: Deploy Azure Functions

1. **Create Function App** (if not exists):
```bash
az functionapp create \
  --resource-group SAXMegaMind-RG \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name saxmegamind-processor \
  --storage-account saxmegamindstorage
```

2. **Deploy the functions**:
```bash
cd /Users/tom/Desktop/WARP/SAXMegaMind-Functions/SAXMegaMindDocuments/AzureFunctions
npm init -y
npm install @azure/storage-blob @azure/search-documents @azure/openai

# Create function.json for each function
func init --javascript
func new --name SemanticDocumentProcessor --template "HTTP trigger"
func new --name CheckDuplicate --template "HTTP trigger"
func new --name MultiLocationCopy --template "HTTP trigger"
func new --name ConvertToJSONL --template "HTTP trigger"

# Deploy
func azure functionapp publish saxmegamind-processor
```

3. **Set environment variables**:
```bash
az functionapp config appsettings set \
  --name saxmegamind-processor \
  --resource-group SAXMegaMind-RG \
  --settings \
    "STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=saxmegamindprimary;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net" \
    "SEARCH_ENDPOINT=https://saxmegamindsearch.search.windows.net" \
    "SEARCH_API_KEY=Qs8Nx5Km2Lp9Wr3Yh7Jf4Gd1Vb6Nt8Zc5Mz2Kx9Pq7" \
    "OPENAI_ENDPOINT=https://saxmegamind-openai.openai.azure.com" \
    "OPENAI_API_KEY=sk-proj-9X7mN3Kp5Qr8Sw2Lv6Ht4Yj1Bf9Gd3Zc5Nx8Km2"
```

### Step 2: Create Azure Storage Accounts

1. **Primary Storage**:
```bash
az storage account create \
  --name saxmegamindprimary \
  --resource-group SAXMegaMind-RG \
  --location eastus \
  --sku Standard_LRS

az storage container create \
  --name documents \
  --account-name saxmegamindprimary
```

2. **Secondary Storage**:
```bash
az storage account create \
  --name saxmegamindsecondary \
  --resource-group SAXMegaMind-RG \
  --location westus \
  --sku Standard_GRS

az storage container create \
  --name documents-backup \
  --account-name saxmegamindsecondary
```

3. **Archive Storage**:
```bash
az storage account create \
  --name saxmegamindarchive \
  --resource-group SAXMegaMind-RG \
  --location eastus \
  --sku Standard_LRS \
  --access-tier Archive

az storage container create \
  --name documents-archive \
  --account-name saxmegamindarchive
```

### Step 3: Create Azure Cognitive Search Indexes

1. **Create Search Service** (if not exists):
```bash
az search service create \
  --name saxmegamindsearch \
  --resource-group SAXMegaMind-RG \
  --sku standard \
  --location eastus
```

2. **Create indexes using REST API**:

```json
# megamind-documents-v3 index
{
  "name": "megamind-documents-v3",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true},
    {"name": "fileName", "type": "Edm.String", "searchable": true},
    {"name": "fileType", "type": "Edm.String", "filterable": true},
    {"name": "documentType", "type": "Edm.String", "filterable": true},
    {"name": "department", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "title", "type": "Edm.String", "searchable": true},
    {"name": "description", "type": "Edm.String", "searchable": true},
    {"name": "keywords", "type": "Edm.String", "searchable": true},
    {"name": "version", "type": "Edm.String", "filterable": true},
    {"name": "uploadDate", "type": "Edm.DateTimeOffset", "filterable": true, "sortable": true},
    {"name": "blobUrl", "type": "Edm.String"},
    {"name": "blobUrlSecondary", "type": "Edm.String"},
    {"name": "blobUrlArchive", "type": "Edm.String"},
    {"name": "summary", "type": "Edm.String", "searchable": true},
    {"name": "sentiment", "type": "Edm.String", "filterable": true},
    {"name": "keyPhrases", "type": "Collection(Edm.String)", "searchable": true},
    {"name": "entities", "type": "Collection(Edm.String)", "searchable": true},
    {"name": "topics", "type": "Collection(Edm.String)", "facetable": true},
    {"name": "fileHash", "type": "Edm.String", "filterable": true},
    {"name": "extractedText", "type": "Edm.String", "searchable": true},
    {"name": "pages", "type": "Edm.Int32", "filterable": true},
    {"name": "language", "type": "Edm.String", "filterable": true}
  ],
  "suggesters": [
    {
      "name": "sg",
      "searchMode": "analyzingInfixMatching",
      "sourceFields": ["fileName", "title", "keywords"]
    }
  ],
  "semanticConfiguration": {
    "configurations": [
      {
        "name": "default",
        "prioritizedFields": {
          "titleField": {"fieldName": "title"},
          "prioritizedContentFields": [
            {"fieldName": "extractedText"},
            {"fieldName": "summary"},
            {"fieldName": "description"}
          ],
          "prioritizedKeywordsFields": [
            {"fieldName": "keywords"},
            {"fieldName": "keyPhrases"}
          ]
        }
      }
    ]
  }
}

# megamind-vectors-v3 index  
{
  "name": "megamind-vectors-v3",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true},
    {"name": "parentId", "type": "Edm.String", "filterable": true},
    {"name": "chunkIndex", "type": "Edm.Int32", "filterable": true},
    {"name": "content", "type": "Edm.String", "searchable": true},
    {"name": "contentVector", "type": "Collection(Edm.Single)", "dimensions": 1536, "vectorSearchConfiguration": "default"},
    {"name": "startOffset", "type": "Edm.Int32"},
    {"name": "endOffset", "type": "Edm.Int32"},
    {"name": "keyPhrases", "type": "Collection(Edm.String)", "searchable": true},
    {"name": "entities", "type": "Collection(Edm.String)", "searchable": true},
    {"name": "wordCount", "type": "Edm.Int32", "filterable": true}
  ],
  "vectorSearch": {
    "algorithms": [
      {
        "name": "default",
        "kind": "hnsw",
        "hnswParameters": {
          "metric": "cosine",
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500
        }
      }
    ]
  }
}
```

### Step 4: Set Up Azure AI Services

1. **Create Document Intelligence resource**:
```bash
az cognitiveservices account create \
  --name saxmegamind-docai \
  --resource-group SAXMegaMind-RG \
  --kind FormRecognizer \
  --sku S0 \
  --location eastus
```

2. **Create Computer Vision resource**:
```bash
az cognitiveservices account create \
  --name saxmegamind-vision \
  --resource-group SAXMegaMind-RG \
  --kind ComputerVision \
  --sku S1 \
  --location eastus
```

3. **Create Azure OpenAI resource**:
```bash
az cognitiveservices account create \
  --name saxmegamind-openai \
  --resource-group SAXMegaMind-RG \
  --kind OpenAI \
  --sku S0 \
  --location eastus

# Deploy embedding model
az cognitiveservices account deployment create \
  --name saxmegamind-openai \
  --resource-group SAXMegaMind-RG \
  --deployment-name text-embedding-ada-002 \
  --model-name text-embedding-ada-002 \
  --model-version "2" \
  --model-format OpenAI \
  --scale-settings-scale-type "Standard"
```

### Step 5: Deploy Client-Side Code

1. **Add to document-upload.html**:
```html
<!-- Add before closing </body> tag -->
<script src="/SAXMegaMind-Functions/SAXMegaMindDocuments/megamind-advanced-processor.js"></script>

<script>
// Initialize processor when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('MegaMind Advanced Processor loaded');
    
    // Override form submission to use advanced processor
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            try {
                const result = await window.uploadDocument(formData);
                console.log('Upload successful:', result);
                
                // Show success message
                if (result.success) {
                    alert(`Document processed successfully!
                        - ${result.semanticChunks} semantic chunks created
                        - ${result.vectorsGenerated} vectors generated
                        - Document type: ${result.documentType}
                        - Indexed: ${result.indexed}`);
                }
            } catch (error) {
                console.error('Upload failed:', error);
                alert('Upload failed: ' + error.message);
            }
        });
    }
});
</script>
```

### Step 6: Configure n8n Webhooks (Optional)

Create these webhooks in n8n for status monitoring:
- `/webhook/megamind/process-document` - Document processing start
- `/webhook/megamind/status` - Processing status updates
- `/webhook/megamind/complete` - Processing completion
- `/webhook/megamind/error` - Error notifications

## Testing

1. **Test file upload**:
```javascript
// Test with a sample PDF
const testFile = new File(["test content"], "test.pdf", { type: "application/pdf" });
const result = await window.MegaMindProcessor.processDocument(testFile, {
    department: 'IT',
    sopType: 'procedure',
    title: 'Test Document',
    skipDuplicates: true
});
console.log('Test result:', result);
```

2. **Verify in Azure Portal**:
- Check blob storage for uploaded files in all 3 locations
- Verify search index has document entries
- Check Application Insights for function execution logs

## Features in Action

### Deduplication
- Calculates SHA-256 hash of file content
- Checks against existing documents before processing
- Prevents duplicate uploads automatically

### Semantic Processing
- Chunks documents into ~1000 token segments
- Extracts key phrases and entities from each chunk
- Generates summary and sentiment analysis
- Creates topic clusters

### Vectorization
- Generates 1536-dimensional embeddings for each chunk
- Enables semantic similarity search
- Powers "find similar documents" features

### Multi-Format Support
- **PDFs**: Full text extraction with Document Intelligence
- **Word/Excel**: Native format processing
- **Images**: OCR with Computer Vision
- **Scanned PDFs**: Automatic OCR detection and processing

### Multi-Location Storage
- **Primary**: Fast access for active documents
- **Secondary**: Geographic redundancy (different region)
- **Archive**: Long-term storage with lower cost

## Monitoring

Check these endpoints for health:
- Function App: `https://saxmegamind-processor.azurewebsites.net/api/health`
- Search Service: `https://saxmegamindsearch.search.windows.net/indexes?api-version=2023-11-01`
- Storage: `https://saxmegamindprimary.blob.core.windows.net/documents?restype=container`

## Troubleshooting

### Common Issues

1. **"Duplicate document detected"**
   - This is working as intended - the system found an identical file
   - To override, set `skipDuplicates: false` in metadata

2. **"Embedding generation failed"**
   - Check Azure OpenAI quota and rate limits
   - Verify deployment name is correct

3. **"OCR processing failed"**
   - Check Computer Vision API key
   - Ensure blob URL is accessible

4. **"Search index update failed"**
   - Verify index schema matches document structure
   - Check search service quota

## Cost Optimization

- Use Standard tier for Search Service (not Free - it has limitations)
- Archive storage for documents older than 90 days
- Batch embedding requests to reduce API calls
- Enable auto-scaling for Function App during peak hours

## Security Notes

⚠️ **IMPORTANT**: The API keys in the code are placeholders. Replace with actual keys from:
1. Azure Portal → Resource → Keys and Endpoint
2. Store keys in Azure Key Vault for production
3. Use Managed Identity where possible

## Next Steps

1. Set up Azure Monitor alerts for failures
2. Configure backup retention policies
3. Implement user authentication for document access
4. Add document versioning support
5. Enable cross-region replication for disaster recovery
