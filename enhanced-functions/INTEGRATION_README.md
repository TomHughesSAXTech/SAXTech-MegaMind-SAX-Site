# SAXMegaMind Document Processing Integration

## Overview
This integration connects the document upload functionality from your website to the Azure infrastructure for document processing, indexing, and storage.

## Architecture Flow

```
Website Upload → n8n Webhook → Azure Function (Process) → Blob Storage → Azure AI Search
```

## Components

### 1. **n8n Workflow: SAXTech SOP Document Processor**
- **Webhook Endpoint**: `/webhook/sop-document-upload`
- **Purpose**: Orchestrates the document processing pipeline
- **Workflow ID**: `rTp5xOx7HKY50Nrw`

### 2. **Document Processing Steps**

#### Step 1: Document Upload Webhook
- Receives documents from website
- Accepts: fileName, fileContent, mimeType, department, documentType

#### Step 2: Parse Document Metadata
- Extracts and normalizes metadata
- Adds timestamp
- Sets defaults for missing fields

#### Step 3: Process Document (Azure Function)
- **Endpoint**: `https://saxmegamind-documents.azurewebsites.net/api/ProcessDocument`
- Converts documents to searchable text
- Extracts content for indexing
- Generates document ID

#### Step 4: Store Original Document
- **Container**: `original-documents`
- **Storage Account**: `saxmegaminddocs`
- Preserves original file format
- Maintains original file content

#### Step 5: Store Converted Document
- **Container**: `converted-documents`
- **Storage Account**: `saxmegaminddocs`
- Stores extracted text version
- Optimized for search indexing

#### Step 6: Index Document
- **Search Service**: `saxmegamind-search`
- **Index**: `sop-documents`
- Creates searchable index entry
- Links to both blob versions

## Configuration Required

### n8n Credentials
1. **Azure Function Key** (`azureFunctionKey`)
   - Get from Azure Function App settings
   - Used for ProcessDocument function

2. **Blob SAS Token** (`blobSasToken`)
   - Generate from Storage Account
   - Needs read/write permissions

3. **Azure Search Key** (`azureSearchKey`)
   - Get from Azure AI Search service
   - Admin key for indexing

### Website Integration
The website should POST to the n8n webhook with:
```json
{
  "fileName": "document.pdf",
  "fileContent": "base64_encoded_content",
  "mimeType": "application/pdf",
  "department": "IT",  // optional
  "documentType": "SOP"  // optional
}
```

### Response Format
```json
{
  "success": true,
  "documentId": "generated-uuid",
  "originalBlobUrl": "https://saxmegaminddocs.blob.core.windows.net/original-documents/document.pdf",
  "convertedBlobUrl": "https://saxmegaminddocs.blob.core.windows.net/converted-documents/document.txt",
  "indexed": true,
  "message": "Document processed and indexed successfully",
  "extractedText": "First 500 characters of extracted text..."
}
```

## Azure Resources Used

### Storage Account: `saxmegaminddocs`
- **Original Documents Container**: Stores uploaded files as-is
- **Converted Documents Container**: Stores extracted text versions

### Function App: `SAXMegaMind-Documents`
- **ProcessDocument Function**: Handles document conversion and text extraction

### AI Search: `saxmegamind-search`
- **Index**: `sop-documents`
- Enables full-text search across all documents
- Maintains metadata and links to blob storage

## Testing the Integration

1. **Test via n8n**:
   - Import the workflow JSON
   - Configure credentials
   - Use n8n's test webhook feature

2. **Test via curl**:
```bash
curl -X POST https://your-n8n-instance.com/webhook/sop-document-upload \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.pdf",
    "fileContent": "base64_content_here",
    "mimeType": "application/pdf",
    "department": "IT",
    "documentType": "SOP"
  }'
```

## Search Integration
Once documents are indexed, they can be searched via:
- Azure AI Search REST API
- Integration with MegaMind SAX main workflow
- Direct queries to the search index

## Notes
- This workflow is completely separate from ITGlue integration
- Documents are stored in two formats for flexibility
- Search index enables semantic search capabilities
- All components are within the SAXMegaMind ecosystem
