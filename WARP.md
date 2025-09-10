# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

The SAXTech-MegaMind-SAX-Site is an Azure Static Web App that serves as a document management portal with AI-powered document processing capabilities. It integrates with Azure Functions, Azure AI Search, and n8n workflow automation for comprehensive document indexing and retrieval.

## Common Development Commands

### Local Development

```bash
# Serve the site locally with Python HTTP server
python3 serve.py
# This starts a server on http://localhost:8080 with cache-control headers disabled

# Alternative: Use any static file server
npx http-server -p 8080 --cors

# Test Azure Functions locally (requires Azure Functions Core Tools)
cd api
func start
```

### Deployment

```bash
# Deploy through GitHub Actions (automatic on push to main)
git push origin main

# Manual deployment with Azure Static Web Apps CLI
swa deploy ./

# Create deployment package
zip -r site-deployment.zip . -x "*.git*" -x "node_modules/*" -x "*.DS_Store"
```

### n8n Webhook Testing

```bash
# Test document upload webhook
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

# Test unified upload webhook (new pattern)
curl -X POST https://workflows.saxtechnology.com/webhook/megamind/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "base64_encoded_content",
    "fileName": "document.pdf",
    "department": "IT",
    "title": "Test Document"
  }'
```

## Architecture & Core Components

### Document Processing Pipeline

The application follows a dual-path upload strategy:

1. **Primary Path**: Direct upload to Azure Function (`SAXMegaMindDocuments`)
2. **Secondary Path**: n8n webhook processing for AI enrichment

```
User Upload (document-upload.html)
    ├── Azure Function API (/api/documents/process)
    │   └── Document Storage + Basic Processing
    └── n8n Webhook (non-blocking)
        ├── Text Extraction
        ├── Deduplication (SHA256)
        ├── OpenAI Embeddings
        └── Azure AI Search Indexing
```

### Key Files & Their Responsibilities

- **`index.html`**: Main portal with MSAL authentication and chat interface
- **`document-upload.html`**: Document upload form with department categorization
- **`js/unified-n8n-upload-handler.js`**: Unified webhook handler following Foreman AI pattern
- **`api/megamind-chat/`**: Azure Function for chat/webhook processing
- **`staticwebapp.config.json`**: Azure Static Web Apps routing and CORS configuration

### n8n Integration Points

**Workflow ID**: `DGFfUihtBiCacKyD` (SOP Document Processor)

**Webhook Endpoints**:
- Upload: `https://workflows.saxtechnology.com/webhook/sop-document-upload`
- Unified: `https://workflows.saxtechnology.com/webhook/megamind/upload`
- Search: `https://workflows.saxtechnology.com/webhook/megamind/search`
- Index: `https://workflows.saxtechnology.com/webhook/megamind/index`

The n8n workflow handles:
- Document text extraction
- Duplicate detection via file hashing
- Embedding generation (OpenAI text-embedding-3-large)
- Azure AI Search indexing with metadata
- Blob storage organization by department

### Authentication Flow

The application uses Microsoft Authentication Library (MSAL) for Azure AD authentication:

1. User arrives at `index.html`
2. MSAL checks for existing session
3. If not authenticated, shows sign-in overlay
4. After authentication, displays user profile and unlocks features
5. Protected routes require valid Azure AD token

### Azure Resources

**Resource Group**: `SAXMegaMind`

**Key Services**:
- **Function App**: `SAXMegaMindDocuments` - Document processing API
- **Storage Account**: `saxmegamind` - Document blob storage
  - Container: `saxdocuments`
  - Folders: `original-documents/{department}/`, `converted-documents/{department}/`
- **Search Service**: `saxmegamind` - AI-powered document search
  - Index: `sop-documents`
- **Static Web App**: Hosts the frontend application

## Deployment Configuration

### GitHub Actions Workflow

The site auto-deploys on push to `main` branch via `.github/workflows/azure-static-web-apps-yellow-glacier-0b334220f.yml`

**Required Secrets**:
- `AZURE_STATIC_WEB_APPS_API_TOKEN_YELLOW_GLACIER_0B334220F`
- `GITHUB_TOKEN` (automatic)

### Environment Variables

Credentials are embedded in n8n workflow nodes:
- Azure Blob Storage SAS tokens
- Azure AI Search admin keys
- Azure Function keys
- OpenAI API keys

## Troubleshooting Common Issues

### Document Upload Failures

1. **Check n8n workflow status**: Navigate to https://workflows.saxtechnology.com and verify workflow is active
2. **Verify Azure Function**: Check Function App logs in Azure Portal
3. **Test webhook directly**: Use curl commands above to isolate issues

### Authentication Issues

1. **Clear browser cache**: MSAL tokens may be stale
2. **Check Azure AD app registration**: Ensure redirect URIs match deployment URL
3. **Verify MSAL configuration**: Check client ID in `index.html`

### Search Not Returning Results

1. **Verify index exists**: Check Azure AI Search for `sop-documents` index
2. **Check document indexing**: Review n8n execution logs for indexing errors
3. **Validate embeddings**: Ensure OpenAI API key is valid in n8n workflow

## Important Patterns

### Unified Upload Handler

The application uses a unified n8n upload pattern (`js/unified-n8n-upload-handler.js`) that:
- Routes all uploads through n8n webhooks first
- Supports chunking for files > 50MB
- Calculates SHA256 hashes for deduplication
- Maps departments to client structures
- Determines processing type based on file metadata

### Document Metadata Structure

```javascript
{
  file: {
    name: "document.pdf",
    content: "base64_encoded_content",
    type: "application/pdf",
    size: 1234567
  },
  metadata: {
    department: "IT|HR|Finance|Operations|...",
    documentType: "Policy|Procedure|Form|Template|...",
    title: "Document Title",
    description: "Description",
    keywords: "comma,separated,keywords",
    version: "1.0"
  }
}
```

### Deployment Structure

The `deployments/` folder contains deployment artifacts with active deployment tracked in `deployments/active` file. Each deployment gets a unique hash-based folder.

## Development Tips

- Use `serve.py` for local development to avoid caching issues
- Test n8n webhooks independently before full integration testing
- Monitor n8n execution logs for debugging document processing
- Azure Function logs available in Azure Portal under Function App > Functions > Logs
- Check browser console for MSAL authentication errors
- For large file uploads (>10MB), ensure base64 encoding doesn't hit memory limits

## Key Integration Points

1. **MSAL Authentication**: Configured in `index.html` with Azure AD integration
2. **n8n Webhooks**: All document processing flows through n8n for AI enrichment
3. **Azure Functions**: Backend API for document storage and processing
4. **Azure AI Search**: Full-text and vector search capabilities for indexed documents
5. **Blob Storage**: Persistent storage for original and processed documents

## Monitoring & Operations

- **n8n Dashboard**: https://workflows.saxtechnology.com - Check workflow executions
- **Azure Portal**: Monitor Function App performance and logs
- **GitHub Actions**: Check deployment status at repository Actions tab
- **Azure AI Search**: Query metrics and indexing status in Azure Portal
