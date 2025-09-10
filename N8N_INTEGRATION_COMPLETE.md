# SAXTech Document Processing Pipeline - Complete Integration Guide

## Overview
This document details the complete integration between the SAXTech MegaMind SAX website and the n8n document processing workflow for AI-powered document indexing.

## Architecture Summary

```
User Upload (Website) 
    ↓
Azure Function (Document Storage)
    ↓
n8n Webhook Trigger
    ↓
Document Processing Pipeline
    ├── Text Extraction (Azure Function)
    ├── Blob Storage (Original & Converted)
    ├── Deduplication Check (SHA256 Hash)
    ├── Embedding Generation (OpenAI)
    └── Azure AI Search Indexing
```

## Components

### 1. Website Integration (`document-upload.html`)

**Location**: `/Users/tom/Desktop/WARP/SAXTech-MegaMind-SAX-Site/document-upload.html`

**Key Features**:
- Dual upload system: Azure Functions + n8n workflow
- Non-blocking n8n integration (Azure upload succeeds even if n8n fails)
- Base64 file encoding for n8n webhook
- Comprehensive metadata capture

**Configuration**:
```javascript
n8n: {
    webhookUrl: 'https://workflows.saxtechnology.com/webhook/sop-document-upload',
    enabled: true  // Toggle to enable/disable n8n integration
}
```

### 2. n8n Workflow - SOP Document Processor

**Workflow ID**: `DGFfUihtBiCacKyD`
**Status**: Active ✓
**Webhook URL**: `https://workflows.saxtechnology.com/webhook/sop-document-upload`

**Workflow Steps**:
1. **Webhook Trigger**: Receives document uploads from website
2. **Metadata Parser**: Extracts and validates document metadata
3. **Azure Function Call**: Processes document (text extraction, conversion)
4. **Deduplication**: Checks for duplicates using SHA256 hash
5. **Blob Storage**: Stores original and converted documents
6. **Embedding Generation**: Creates vectors using OpenAI text-embedding-3-large
7. **Azure AI Search**: Indexes document with metadata and embeddings
8. **Response Handler**: Returns structured JSON response

### 3. Azure Function - Document Processor

**Location**: `SAXMegaMindDocuments` Function App
**Endpoint**: `https://saxmegamind-documents.azurewebsites.net/api/documents/process`

**Deduplication Logic** (C# Implementation):
```csharp
private async Task<bool> CheckForDuplicate(string fileHash)
{
    var searchClient = new SearchClient(
        new Uri(searchEndpoint),
        "sop-documents",
        new AzureKeyCredential(searchApiKey)
    );
    
    var searchOptions = new SearchOptions
    {
        Filter = $"fileHash eq '{fileHash}'",
        Size = 1,
        Select = { "id", "title", "fileHash" }
    };
    
    var response = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
    return response.Value.TotalCount > 0;
}
```

### 4. Azure Resources

**Blob Storage Containers**:
- `original-documents`: Stores original uploaded files
- `converted-documents`: Stores processed/extracted text files

**Azure AI Search**:
- Index: `sop-documents`
- Key fields: `id`, `title`, `content`, `embeddings`, `fileHash`
- Capabilities: Semantic search, vector search, faceting

## Data Flow

### Upload Process

1. **User uploads document** on website
2. **Website JavaScript**:
   - Uploads to Azure Function first
   - On success, triggers n8n webhook with base64 encoded file
   - Shows success message to user

3. **n8n Workflow**:
   - Receives webhook payload
   - Calls Azure Function for processing
   - Checks for duplicates
   - Stores in blob containers
   - Generates embeddings
   - Indexes in Azure AI Search

### Payload Structure

```json
{
  "file": {
    "name": "document.pdf",
    "type": "application/pdf",
    "size": 1234567,
    "content": "base64_encoded_content",
    "contentType": "application/pdf"
  },
  "metadata": {
    "department": "Accounting",
    "documentType": "Process Documentation",
    "title": "Monthly Close Procedures",
    "description": "Step-by-step guide for month-end closing",
    "keywords": "accounting, month-end, procedures",
    "version": "1.0",
    "uploadedBy": "SAX Portal User",
    "uploadDate": "2024-01-09T12:00:00Z",
    "source": "SAX Document Portal"
  },
  "indexing": {
    "indexName": "sop-documents",
    "generateEmbeddings": true,
    "extractEntities": true
  }
}
```

## Security & Credentials

All credentials are embedded in the n8n workflow nodes:

- **Azure Blob Storage**: SAS token with 10+ year expiry
- **Azure AI Search**: Admin key for full index management
- **Azure Function**: Function key for secure API access
- **OpenAI**: API key for embedding generation

## Testing the Integration

### 1. Test Document Upload
```bash
# Navigate to the document upload page
https://your-site-url/document-upload.html

# Upload a test document and verify:
- Azure Function upload succeeds
- n8n webhook triggers (check n8n executions)
- Document appears in blob storage
- Document is indexed in Azure AI Search
```

### 2. Test n8n Webhook Directly
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/sop-document-upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": {
      "name": "test.txt",
      "content": "VGVzdCBjb250ZW50",
      "type": "text/plain"
    },
    "metadata": {
      "department": "IT",
      "title": "Test Document"
    }
  }'
```

### 3. Verify Azure AI Search
```bash
# Search for indexed documents
curl -X POST https://saxmegamind.search.windows.net/indexes/sop-documents/docs/search?api-version=2023-11-01 \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_SEARCH_KEY" \
  -d '{
    "search": "test document",
    "top": 10
  }'
```

## Monitoring & Troubleshooting

### Check n8n Workflow Executions
1. Go to n8n dashboard
2. Navigate to "Executions"
3. Filter by workflow: "SOP Document Processor"
4. Review execution logs for errors

### Common Issues & Solutions

**Issue**: Document uploads but doesn't index
- Check n8n execution logs
- Verify Azure Function is accessible
- Ensure Azure AI Search index exists

**Issue**: Duplicate documents being indexed
- Verify deduplication logic in Azure Function
- Check fileHash generation is consistent

**Issue**: n8n webhook not triggering
- Verify webhook URL is correct
- Check n8n workflow is active
- Review browser console for errors

### Enable/Disable n8n Integration
In `document-upload.html`, modify:
```javascript
n8n: {
    enabled: false  // Set to false to disable n8n integration
}
```

## Performance Considerations

- **File Size Limit**: 10MB recommended for base64 encoding
- **Processing Time**: ~5-10 seconds for typical documents
- **Concurrent Uploads**: n8n can handle multiple simultaneous uploads
- **Rate Limiting**: None currently implemented

## Future Enhancements

1. **Batch Processing**: Support for multiple file uploads
2. **Progress Tracking**: Real-time status updates via WebSocket
3. **Advanced Deduplication**: Content similarity checking beyond hash
4. **Incremental Updates**: Smart updates for document versions
5. **Search Analytics**: Track search queries and improve relevance

## Support & Maintenance

**n8n Workflow**: 
- Location: https://workflows.saxtechnology.com
- Workflow ID: DGFfUihtBiCacKyD

**Azure Resources**:
- Resource Group: SAXMegaMind
- Function App: SAXMegaMindDocuments
- Storage Account: saxmegamind
- Search Service: saxmegamind

**GitHub Repositories**:
- Website: https://github.com/TomHughesSAXTech/SAXTech-MegaMind-SAX-Site
- Functions: https://github.com/TomHughesSAXTech/SAXMegaMind-Functions

## Contact
For issues or questions about this integration, contact the SAXTech development team.

---
*Last Updated: January 9, 2025*
*Version: 1.0*
