# SAXTech Azure Backup Automation

Comprehensive automated backup system for all SAXTech Azure resources, including Function Apps (settings + source code), Azure Search indices, Static Web Apps, and n8n workflows.

## 🚀 Status

[![Azure Backup Automation](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/actions/workflows/azure-backup.yml/badge.svg)](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/actions/workflows/azure-backup.yml)

## 📅 Backup Schedule

- **Automated:** Hourly backups via GitHub Actions
- **Manual:** Can be triggered anytime via GitHub Actions with selective backup types
- **Retention:** 7 days in Azure Storage, 1 day for GitHub artifacts

## 🗂️ Resources Protected

### Static Web Apps
- SAXTech-MegaMind-SAX-Site (megamind.saxtechnology.com)
- SAXTech-AskForeman-Site (askforeman.saxtechnology.com)
- SAXTech-MegaMind-IT-Site
- ROwen-2025DaterClubs-Site (daterclubs2025.saxtechnology.com)
- Additional SAXTech static sites

### Function Apps
- askforeman-functions
- fcsjsonparser
- SAXTech-DocProcessor
- saxtech-employee-lookup
- SAXTech-MegaMind-OCR
- saxtech-metrics-api
- saxtech-tax-ingestor
- saxtechconversationlogs
- saxtechmegamindfunctions

### Function Apps Source Code
- Complete source code via SCM API
- App settings and configurations
- Deployment packages and history
- ARM templates for infrastructure recreation

### Azure Search Services
- **saxmegamind-search**: 4 indices with 40,795+ documents
- **fcssearchservice**: AskForeman project search service
- **saxtechmegamindsearch3**: MegaMind IT project search service
- Complete index schemas, documents, and embeddings
- Data sources, indexers, and synonym maps

### n8n Workflows
- 57+ workflows from saxn8n.saxtechnology.com
- All configurations and settings
- Workflow connections and credentials metadata

## 🛠️ Quick Commands

### Run Manual Backup

1. Go to [Actions](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/actions)
2. Select "Azure Backup Automation"
3. Click "Run workflow"
4. Choose backup type: all, function-apps, function-apps-source, static-web-apps, n8n-workflows, or azure-search

### Local Backup Scripts

```bash
# Run comprehensive assessment
./azure-backup-assessment.sh

# Backup Function Apps (settings)
./backup-function-apps.sh

# Backup Function Apps (source code)
./backup-function-app-source.sh

# Backup Azure Search indices
./backup-azure-search-indices-fixed.sh

# Backup Static Web Apps
./backup-static-web-apps.sh
```

## 💾 Storage Locations

### Primary: GitHub Repository
- Branch: `backups`
- Path: `/azure-backups/`
- Organized by resource type and date

### Secondary: Azure Storage
- **Account:** saxtechbackups
- **Container:** azure-backups
- **Replication:** Geo-redundant (East US 2 + Central US)
- **Retention:** 30 days

## 🔐 Security

### Required Secrets

Configure these in [Repository Settings > Secrets](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/settings/secrets/actions):

1. **AZURE_CREDENTIALS**: Azure service principal credentials
2. **N8N_API_KEY**: n8n API key for workflow backups
3. **SAXMEGAMIND_SEARCH_KEY**: API key for saxmegamind-search service
4. **FCS_SEARCH_KEY**: API key for fcssearchservice 
5. **SAXTECHMEGAMINDSEARCH3_KEY**: API key for saxtechmegamindsearch3 service

See [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) for detailed configuration instructions.

### Azure Credentials Format

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

## 📁 Backup Structure

```
azure-backups/
├── function-apps/
│   └── YYYYMMDD_HHMMSS/
│       ├── {app-name}/
│       │   ├── config.json
│       │   ├── appsettings.json
│       │   ├── arm_template.json
│       │   └── {app-name}_package.zip
│       └── backup_summary.json
├── function-app-source/
│   └── YYYYMMDD_HHMMSS/
│       ├── {app-name}/
│       │   ├── app_settings.json
│       │   ├── site_content.zip
│       │   ├── complete_site.zip
│       │   ├── functions_list.json
│       │   └── restore_function_app.sh
│       └── restore_all_function_apps.sh
├── azure-search/
│   └── YYYYMMDD_HHMMSS/
│       ├── {service-name}/
│       │   ├── indices/{index-name}/
│       │   │   ├── schema.json
│       │   │   ├── documents_batch_*.json
│       │   │   └── restore_index.sh
│       │   ├── datasources/
│       │   ├── indexers/
│       │   └── restore_service.sh
│       └── restore_all_services.sh
├── static-web-apps/
│   └── YYYYMMDD_HHMMSS/
│       ├── {app-name}/
│       │   ├── config.json
│       │   ├── custom_domains.json
│       │   └── environments.json
│       └── backup_summary.json
└── n8n-workflows/
    └── YYYYMMDD/
        ├── workflows.json
        └── {workflow-name}_{id}.json
```

## 🔄 Restore Procedures

### Function Apps (Settings)
```bash
cd azure-backups/function-apps/[timestamp]/
./restore.sh
```

### Function Apps (Source Code)
```bash
cd azure-backups/function-app-source/[timestamp]/
./restore_all_function_apps.sh
# Or restore individual apps:
cd {app-name}/
./restore_function_app.sh
```

### Azure Search Services
```bash
cd azure-backups/azure-search/[timestamp]/
./restore_all_services.sh
# Or restore individual services/indices:
cd {service-name}/
./restore_service.sh [api-key]
cd indices/{index-name}/
./restore_index.sh [api-key]
```

### Static Web Apps
```bash
cd azure-backups/static-web-apps/[timestamp]/
./restore.sh
```

### n8n Workflows
1. Open n8n interface
2. Import workflow JSON files
3. Update credentials as needed

## 📊 Monitoring

- Check [GitHub Actions](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/actions) for backup status
- Review assessment reports in Actions artifacts
- Monitor Azure Storage for backup archives

## 🆘 Support

For issues or questions:
- Create an [Issue](https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups/issues)
- Contact SAXTech IT team

## 📝 Notes

- Backups run automatically every 24 hours
- Each backup is tagged with timestamp
- Compressed archives are stored in Azure Storage
- Restore scripts are auto-generated with each backup
- Credentials and secrets are never backed up (must be reconfigured on restore)