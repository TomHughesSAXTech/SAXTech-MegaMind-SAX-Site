# Azure Backup Assessment Report
**Date:** Tue Sep 23 14:33:23 EDT 2025
**Subscription:** SAXTech Azure Subscription

## Static Web Apps

| App Name | Resource Group | GitHub Repo | Branch | Backup Status |
|----------|----------------|-------------|---------|---------------|
| SAXTech-FCSSite | SAXTech-AI | https://github.com/TomHughesSAXTech/SAXTech-AskForeman-Site | main | ✅ GitHub (main) |
| SAXTech-ROICalc | SAXTech-AI | https://github.com/TomHughesSAXTech/roi-webapp-enhanced | main | ✅ GitHub (main) |
| victor-static-app | victor-static-app-rg | N/A | N/A | ⚠️ No GitHub backup |
| dater-club-registration | dater-club-rg | https://github.com/TomHughesSAXTech/ROwen-2025DaterClubs-Site | main | ✅ GitHub (main) |
| askforeman-mobile | SAXTech-AI | https://github.com/TomHughesSAXTech/SAXTech-ASKForeman-MobileSite | main | ✅ GitHub (main) |
| MegaMind-AI | SAXTech-AI | https://github.com/TomHughesSAXTech/SAXTech-MegaMind-SAX-Site | main | ✅ GitHub (main) |
| MegaMind-IT | SAXTech-AI | https://github.com/TomHughesSAXTech/SAXTech-MegaMind-IT-Site | main | ✅ GitHub (main) |
| SAXTech-Artifacts | SAXTech-AI | https://github.com/TomHughesSAXTech/SAXTech-Repository-Site | main | ✅ GitHub (main) |

## Function Apps

| App Name | Resource Group | State | Backup Config | App Settings Backup |
|----------|----------------|-------|---------------|-------------------|
| saxtech-tax-ingestor | SAXTECH-AI | Running | ❌ No backup configured | ⚠️ No source control |
| askforeman-functions | askforeman-rg | Running | ❌ No backup configured | ⚠️ No source control |
| fcsjsonparser | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| SAXTech-MegaMind-OCR | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| saxtechmegamindfunctions | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| SAXTech-DocProcessor | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| saxtech-employee-lookup | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| saxtech-metrics-api | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |
| saxtechconversationlogs | SAXTech-AI | Running | ❌ No backup configured | ⚠️ No source control |

## Storage Accounts

| Storage Account | Resource Group | Kind | Replication | Soft Delete |
|-----------------|----------------|------|-------------|-------------|
| askforemanstorage24 | askforeman-rg | StorageV2 | Standard_LRS | ⚠️ Disabled |
| daterclubstorage3146 | dater-club-rg | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxmegamind | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxtechartifactstorage | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxtechbackups | SAXTech-AI | StorageV2 | Standard_GRS | ⚠️ Disabled |
| saxtechdocs20250821 | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxtechfcs | SAXTech-AI | StorageV2 | Standard_RAGRS | ✅ Enabled |
| saxtechfunctionapps | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxtechmegamind | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |
| saxtechn8nbackups | SAXTech-AI | StorageV2 | Standard_LRS | ⚠️ Disabled |


## Recommendations

### For Static Web Apps:
1. ✅ **Already Protected**: Your Static Web Apps are backed up via GitHub repositories
2. 📋 Consider implementing:
   - Regular GitHub repository backups to another location
   - Configuration export scripts for app settings
   - Automated deployment pipelines for disaster recovery

### For Function Apps:
1. ⚠️ **Action Required**: Configure automated backups for Function Apps without backup
2. 📋 Implement:
   - Azure Backup service configuration
   - Source control integration for all function apps
   - Regular export of app settings and connection strings
   - Function app deployment packages backup

### General Recommendations:
1. Enable soft delete on all storage accounts
2. Use geo-redundant storage (GRS or RA-GRS) for backup data
3. Implement Infrastructure as Code (IaC) using ARM templates or Terraform
4. Set up Azure DevOps or GitHub Actions for CI/CD
5. Create disaster recovery runbooks

