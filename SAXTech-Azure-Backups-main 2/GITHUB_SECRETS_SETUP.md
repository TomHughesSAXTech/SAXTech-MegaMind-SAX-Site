# GitHub Secrets Configuration

This document outlines the GitHub secrets that need to be configured for the automated backup workflows.

## Required Secrets

### 1. Azure Credentials (Already Configured)
- **Secret Name**: `AZURE_CREDENTIALS`
- **Purpose**: Authentication for Azure CLI operations
- **Format**: JSON service principal credentials

### 2. n8n API Key (Already Configured)
- **Secret Name**: `N8N_API_KEY`
- **Purpose**: Access to n8n workflows API
- **Value**: Your n8n API token

### 3. Azure Search Service API Keys (New - Need Configuration)

#### saxmegamind-search Service
- **Secret Name**: `SAXMEGAMIND_SEARCH_KEY`
- **Purpose**: Access to saxmegamind-search service for backup
- **Value**: `sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO`

#### fcssearchservice Service
- **Secret Name**: `FCS_SEARCH_KEY`
- **Purpose**: Access to fcssearchservice for backup
- **Value**: `[YOUR_FCS_API_KEY]` (needs to be provided)

#### saxtechmegamindsearch3 Service
- **Secret Name**: `SAXTECHMEGAMINDSEARCH3_KEY`
- **Purpose**: Access to saxtechmegamindsearch3 service for backup
- **Value**: `[YOUR_MEGAMIND_IT_API_KEY]` (needs to be provided)

## How to Add GitHub Secrets

1. Go to your GitHub repository: `https://github.com/TomHughesSAXTech/SAXTech-Azure-Backups`
2. Click on **Settings** tab
3. Click on **Secrets and variables** → **Actions**
4. Click **New repository secret** for each secret needed
5. Enter the **Name** and **Value** for each secret
6. Click **Add secret**

## Updated Backup Workflow Features

The GitHub Actions workflow now includes:

### New Backup Jobs
- **Function Apps Source Code Backup**: Downloads SCM packages, source code, and configurations
- **Azure Search Indices Backup**: Backs up indices, schemas, documents, and search service configurations

### Enhanced Workflow Options
- **All**: Runs all backup types (default)
- **function-apps**: Original Function App settings backup
- **function-apps-source**: New source code backup
- **static-web-apps**: Static web app configurations
- **n8n-workflows**: n8n workflow definitions
- **azure-search**: Azure Search indices and data

### Backup Coverage
- **Function Apps**: Complete settings and source code backup
- **Azure Search**: Full index backup with documents and embeddings
- **Static Web Apps**: Configuration backup
- **n8n Workflows**: Complete workflow definitions
- **Automated Storage**: All backups uploaded to Azure Blob Storage
- **Retention**: 7-day retention policy for storage cleanup

## Missing API Keys

To enable full Azure Search backup coverage, please provide the missing API keys for:

1. **fcssearchservice** - Used for AskForeman project
2. **saxtechmegamindsearch3** - Used for MegaMind IT project

These can be found in your Azure portal under each search service's "Keys" section.

## Backup Schedule

The workflow runs:
- **Hourly**: Automated schedule via cron (`0 * * * *`)
- **Manual**: Via workflow dispatch with selectable backup types
- **Retention**: 7 days for Azure Storage, 1 day for GitHub artifacts

## Restore Capabilities

Each backup includes automated restore scripts:
- **Individual restore scripts** for each component
- **Master restore scripts** for complete service restoration
- **Azure CLI commands** for infrastructure recreation
- **Step-by-step instructions** for disaster recovery