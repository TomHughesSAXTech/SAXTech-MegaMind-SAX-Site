# SAXMegaMind Documents - Deployment Summary

## 🚀 Quick Start

### Prerequisites
- Azure Subscription
- Azure CLI installed
- .NET 8 SDK installed
- Azure Functions Core Tools v4

### Deployment Steps

1. **Clone/Navigate to the project:**
```bash
cd /Users/tom/Desktop/WARP/SAXMegaMind-Functions/SAXMegaMindDocuments
```

2. **Run the deployment script:**
```bash
./deploy.sh
```

3. **Create the search index (if not created automatically):**
```bash
# Using Bash
./create-search-index.sh

# Or using PowerShell
./Create-SearchIndex.ps1 -SearchServiceName "your-search-service" -SearchApiKey "your-api-key"
```

## 📋 What Gets Deployed

### Azure Resources Created
1. **Resource Group** - Container for all resources
2. **Storage Account** - For blob storage and function runtime
3. **Blob Container** - "documents" container for file storage
4. **Azure Cognitive Search** - Search service with "saxdocuments" index
5. **Function App** - Hosts the document management functions
6. **Application Insights** - Monitoring and logging

### Search Index Schema
The deployment automatically creates a search index with:
- **34 fields** for comprehensive document metadata
- **Full-text search** on title, description, content, keywords
- **Filtering** by department, documentType, status, dates
- **Faceting** for department, documentType, keywords, tags
- **Autocomplete** suggester for better UX
- **CORS** enabled for cross-origin requests

## 🔗 API Endpoints

Once deployed, your API endpoints will be available at:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `https://{app}.azurewebsites.net/api/documents/search` | Search documents |
| POST | `https://{app}.azurewebsites.net/api/documents/upload` | Upload document |
| GET | `https://{app}.azurewebsites.net/api/documents/list` | List by department |
| GET | `https://{app}.azurewebsites.net/api/documents/view/{id}` | View details |
| GET | `https://{app}.azurewebsites.net/api/documents/download/{id}` | Download file |
| PUT | `https://{app}.azurewebsites.net/api/documents/update/{id}` | Update document |
| DELETE | `https://{app}.azurewebsites.net/api/documents/delete/{id}` | Delete document |
| POST | `https://{app}.azurewebsites.net/api/documents/restore/{id}` | Restore deleted |

## 🔑 Configuration

### Required Settings (Automatic)
These are configured automatically by the deployment script:
- `BlobStorageConnectionString`
- `SearchServiceName`
- `SearchServiceKey`
- `AzureSearchIndexName`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`

### Optional Settings (Manual)
Add these later if you want advanced features:
- `DocumentIntelligenceEndpoint` - For OCR capabilities
- `DocumentIntelligenceKey`
- `OpenAIEndpoint` - For AI-powered insights
- `OpenAIKey`

## 🧪 Testing the Deployment

### 1. Test Document Upload
```bash
curl -X POST https://{app}.azurewebsites.net/api/documents/upload \
  -H "Content-Type: application/json" \
  -d '{
    "fileContent": "base64_encoded_content",
    "fileName": "test.pdf",
    "title": "Test Document",
    "department": "IT",
    "documentType": "Policies"
  }'
```

### 2. Test Document Search
```bash
curl -X POST https://{app}.azurewebsites.net/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "searchText": "test",
    "department": "IT"
  }'
```

### 3. Test Document List
```bash
curl -X GET "https://{app}.azurewebsites.net/api/documents/list?department=IT"
```

## 📊 Monitoring

### View Logs in Azure Portal
1. Navigate to your Function App
2. Go to "Functions" → Select a function → "Monitor"
3. View execution logs and metrics

### Query Application Insights
```bash
az monitor app-insights query \
  --app {app-insights-name} \
  --resource-group {resource-group} \
  --analytics-query 'traces | order by timestamp desc | take 50'
```

## 🔒 Security Considerations

### Department-Based Access
- All operations verify department membership
- Cross-department access is blocked
- Implement Azure AD authentication for production

### SAS Token Security
- Download links expire after 5 minutes
- Unique tokens per request
- No direct blob access

### Production Checklist
- [ ] Configure Azure AD authentication
- [ ] Update CORS settings for specific domains
- [ ] Set up custom domain with SSL
- [ ] Configure backup policies
- [ ] Set up alerts and monitoring
- [ ] Review and adjust retention policies
- [ ] Configure network security (Private Endpoints)

## 🛠️ Maintenance

### Update Function Code
```bash
# Make code changes
dotnet build -c Release

# Redeploy
func azure functionapp publish {function-app-name}
```

### Update Search Index
```bash
# Modify index schema in create-search-index.sh
./create-search-index.sh
```

### View Function Logs
```bash
func azure functionapp logstream {function-app-name}
```

## 📚 Additional Resources

- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Azure Cognitive Search Documentation](https://docs.microsoft.com/en-us/azure/search/)
- [Azure Blob Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/)

## 🆘 Troubleshooting

### Common Issues

1. **Index creation fails**
   - Verify Search Service name and API key
   - Check if index already exists
   - Ensure Search Service tier supports required features

2. **Function not responding**
   - Check Application Settings in Azure Portal
   - Verify all connection strings are correct
   - Review Application Insights for errors

3. **Upload fails**
   - Check blob container exists
   - Verify storage connection string
   - Ensure file size is under limit (50MB default)

4. **Search returns no results**
   - Verify index has documents
   - Check search syntax
   - Ensure department filter matches

## 📞 Support

For issues or questions:
- Review the README.md for detailed documentation
- Check Application Insights for error details
- Contact SAXTech development team

---

**Last Updated:** December 2024
**Version:** 1.0.0
**Copyright © 2024 SAXTech. All rights reserved.**
