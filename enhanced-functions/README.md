# SAXMegaMind Documents Functions

## Overview

The SAXMegaMind Documents Functions provide a comprehensive document management system for the MegaMind portal. This system enables departments to upload, search, view, download, update, and manage documents with full metadata support and security controls.

## Features

### Core Capabilities
- 📤 **Document Upload** - Upload documents with metadata and automatic indexing
- 🔍 **Advanced Search** - Full-text search with filters for department, type, keywords
- 📁 **Document Organization** - Automatic grouping by document types (folders)
- 📥 **Secure Downloads** - Time-limited SAS tokens for secure file access
- ✏️ **Document Updates** - Update metadata and replace files
- 🗑️ **Soft Delete** - Mark documents as deleted with restore capability
- 🔒 **Department Security** - Department-based access control on all operations
- 📊 **Document Intelligence** - OCR and text extraction for searchability

## Azure Functions

### 1. DocumentSearch
**Endpoint:** `POST /api/documents/search`

Search documents with advanced filtering capabilities.

**Request Body:**
```json
{
  "searchText": "security policy",
  "department": "IT",
  "documentType": "Policies",
  "keywords": ["security", "compliance"],
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31",
  "pageSize": 50,
  "skip": 0
}
```

### 2. DocumentUpload
**Endpoint:** `POST /api/documents/upload`

Upload new documents with metadata.

**Request Body (JSON with Base64 file):**
```json
{
  "fileContent": "base64_encoded_file_content",
  "fileName": "IT_Policy_2024.pdf",
  "title": "IT Security Policy 2024",
  "description": "Updated security policies and procedures",
  "department": "IT",
  "documentType": "Policies",
  "author": "John Doe",
  "keywords": "security,policy,IT",
  "tags": "important,compliance"
}
```

### 3. DocumentList
**Endpoint:** `GET /api/documents/list?department={dept}&type={type}`

List documents grouped by type for a department.

**Query Parameters:**
- `department` (required) - Department name
- `type` (optional) - Filter by specific document type

**Response:**
```json
{
  "success": true,
  "folders": {
    "Policies": [...],
    "Forms": [...],
    "Reports": [...]
  },
  "stats": {
    "totalDocuments": 42,
    "lastUpdated": "Dec 15, 2024"
  }
}
```

### 4. DocumentView
**Endpoint:** `GET /api/documents/view/{documentId}`

Get detailed information about a document.

**Query Parameters:**
- `department` - For access verification
- `includeContent=true` - Include content preview
- `includeRelated=true` - Include related documents

### 5. DocumentDownload
**Endpoint:** `GET /api/documents/download/{documentId}`

Generate secure download link for a document.

**Query Parameters:**
- `department` (required) - For access verification
- `requestedBy` - User requesting download

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://...blob.core.windows.net/...?sv=...",
  "fileName": "document.pdf",
  "expiresIn": 300
}
```

### 6. DocumentUpdate
**Endpoint:** `PUT /api/documents/update/{documentId}`

Update document metadata or replace file.

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "version": "2.0",
  "modifiedBy": "Jane Doe",
  "newFileContent": "base64_encoded_content",
  "newFileName": "updated_document.pdf"
}
```

### 7. DocumentDelete
**Endpoint:** `DELETE /api/documents/delete/{documentId}`

Delete document (soft or permanent).

**Query Parameters:**
- `department` (required) - For access verification
- `permanent=true` - Permanent delete (removes blob)
- `deletedBy` - User performing deletion
- `reason` - Reason for deletion

### 8. DocumentRestore
**Endpoint:** `POST /api/documents/restore/{documentId}`

Restore a soft-deleted document.

**Query Parameters:**
- `department` (required) - For access verification
- `restoredBy` - User performing restoration

## Azure Search Index Schema

The documents are indexed with the following fields:

```json
{
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true},
    {"name": "title", "type": "Edm.String", "searchable": true},
    {"name": "description", "type": "Edm.String", "searchable": true},
    {"name": "content", "type": "Edm.String", "searchable": true},
    {"name": "department", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "documentType", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "author", "type": "Edm.String", "filterable": true},
    {"name": "keywords", "type": "Collection(Edm.String)", "searchable": true},
    {"name": "tags", "type": "Collection(Edm.String)", "filterable": true},
    {"name": "status", "type": "Edm.String", "filterable": true},
    {"name": "lastModified", "type": "Edm.DateTimeOffset", "sortable": true},
    {"name": "fileSize", "type": "Edm.Int64", "filterable": true},
    {"name": "fileType", "type": "Edm.String", "filterable": true},
    {"name": "blobUrl", "type": "Edm.String"},
    {"name": "version", "type": "Edm.String"}
  ]
}
```

## Configuration

### Required Azure Resources

1. **Azure Storage Account**
   - Container: `documents`
   - Blob structure: `{department}/{documentId}/{fileName}`

2. **Azure Cognitive Search**
   - Index: `saxdocuments`
   - Minimum tier: Basic

3. **Azure Document Intelligence** (Optional)
   - For OCR and advanced text extraction

4. **Azure OpenAI** (Optional)
   - For document summarization and insights

5. **Application Insights**
   - For monitoring and logging

### Environment Variables

Copy `local.settings.template.json` to `local.settings.json` and update with your Azure resource details:

```json
{
  "BlobStorageConnectionString": "Your storage connection string",
  "SearchServiceName": "Your search service name",
  "SearchServiceKey": "Your search API key",
  "AzureSearchIndexName": "saxdocuments",
  "DocumentIntelligenceEndpoint": "Your Document Intelligence endpoint",
  "DocumentIntelligenceKey": "Your Document Intelligence key",
  "OpenAIEndpoint": "Your OpenAI endpoint",
  "OpenAIKey": "Your OpenAI key"
}
```

## Security Features

### Department-Based Access Control
- All operations verify department membership
- Documents can only be accessed by users in the same department
- Cross-department access is blocked at the API level

### Secure File Downloads
- SAS tokens with 5-minute expiry
- Download URLs are unique per request
- Access logging for audit trails

### Soft Delete with Recovery
- Documents can be soft-deleted (status change)
- Soft-deleted documents can be restored
- Permanent delete removes both index and blob

## Deployment

### Local Development

1. Install Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4
```

2. Install .NET 8 SDK

3. Configure local.settings.json

4. Run locally:
```bash
func start
```

### Azure Deployment

1. Create Function App in Azure Portal
2. Configure Application Settings with all required keys
3. Deploy using VS Code, Azure CLI, or CI/CD:

```bash
func azure functionapp publish YOUR_FUNCTION_APP_NAME
```

## Document Types

Common document types supported:
- **Policies** - Company policies and procedures
- **Forms** - Fillable forms and templates
- **Reports** - Business reports and analytics
- **Guides** - User guides and documentation
- **Contracts** - Legal contracts and agreements
- **Presentations** - PowerPoint presentations
- **Spreadsheets** - Excel files and data sheets

## File Size Limits

- Maximum upload size: 50 MB (configurable)
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, PNG, JPG, JPEG, GIF, BMP, SVG, ZIP, JSON, XML, MD

## Monitoring

### Application Insights Queries

Monitor document operations:

```kusto
// Document uploads
traces
| where message contains "document upload"
| summarize count() by bin(timestamp, 1h)

// Search queries
traces
| where message contains "search request"
| summarize count() by bin(timestamp, 1h)

// Failed operations
traces
| where severityLevel >= 3
| project timestamp, message, customDimensions
```

## Error Handling

All functions return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing parameters)
- `403` - Forbidden (department access denied)
- `404` - Document not found
- `500` - Internal server error

## Best Practices

1. **Always include department parameter** for access control
2. **Use soft delete** for recoverable deletions
3. **Include keywords and tags** for better searchability
4. **Set appropriate retention periods** for compliance
5. **Monitor SAS token usage** for security
6. **Regular backup** of search index and blob storage

## Support

For issues or questions, contact the SAXTech development team.

## License

Copyright © 2024 SAXTech. All rights reserved.
