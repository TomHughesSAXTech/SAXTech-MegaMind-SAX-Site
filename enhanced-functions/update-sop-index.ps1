# SAXMegaMind Documents - Update Search Index for SOPs
# Copyright (c) 2024 SAXTech

param(
    [string]$SearchServiceName = "saxmegamind-search",
    [string]$IndexName = "saxdocuments"
)

# Get the API key
$SearchApiKey = az search admin-key show --service-name $SearchServiceName --resource-group SAXTech-AI --query primaryKey -o tsv

$searchEndpoint = "https://$SearchServiceName.search.windows.net"

Write-Host "Updating Search Index for SOP Documents..." -ForegroundColor Cyan
Write-Host ""

# First, delete the existing index
Write-Host "Deleting existing index..." -ForegroundColor Yellow
$deleteUri = "$searchEndpoint/indexes/$($IndexName)?api-version=2023-11-01"
Invoke-RestMethod -Uri $deleteUri -Headers @{"api-key" = $SearchApiKey} -Method Delete -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Define the enhanced index schema with SOP-specific fields
$indexSchema = @{
    name = $IndexName
    fields = @(
        # Core document fields
        @{
            name = "id"
            type = "Edm.String"
            key = $true
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "title"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $true
            facetable = $false
            retrievable = $true
            analyzer = "standard.lucene"
        },
        @{
            name = "description"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
            analyzer = "standard.lucene"
        },
        @{
            name = "content"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
            analyzer = "standard.lucene"
        },
        
        # SOP-Specific Fields
        @{
            name = "systemName"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $true
            facetable = $true
            retrievable = $true
        },
        @{
            name = "procedureType"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "effectiveDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "isDraft"
            type = "Edm.Boolean"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "applicationArea"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "complianceType"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "processCategory"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "targetAudience"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "relatedSystems"
            type = "Collection(Edm.String)"
            searchable = $true
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "updateFrequency"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        
        # Original fields
        @{
            name = "department"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $true
            retrievable = $true
        },
        @{
            name = "documentType"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $true
            retrievable = $true
        },
        @{
            name = "author"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "keywords"
            type = "Collection(Edm.String)"
            searchable = $true
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "tags"
            type = "Collection(Edm.String)"
            searchable = $true
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "status"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "version"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "lastModified"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "createdDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "fileSize"
            type = "Edm.Int64"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "fileType"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "fileName"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "blobUrl"
            type = "Edm.String"
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "blobName"
            type = "Edm.String"
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "containerName"
            type = "Edm.String"
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "uploadedBy"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "reviewDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "approvedBy"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "approvalDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        }
    )
    suggesters = @(
        @{
            name = "sg"
            searchMode = "analyzingInfixMatching"
            sourceFields = @("title", "systemName", "fileName", "author")
        }
    )
    scoringProfiles = @()
    corsOptions = @{
        allowedOrigins = @("*")
        maxAgeInSeconds = 300
    }
}

# Create the index
Write-Host "Creating enhanced index '$IndexName'..." -ForegroundColor Yellow
$createUri = "$searchEndpoint/indexes?api-version=2023-11-01"

try {
    $headers = @{
        "api-key" = $SearchApiKey
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body (ConvertTo-Json $indexSchema -Depth 10)
    
    Write-Host "✓ Index '$IndexName' created successfully with SOP enhancements!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New SOP-Specific Fields:" -ForegroundColor Cyan
    Write-Host "• systemName - System/Application name (HubSpot, Caseware, etc.)"
    Write-Host "• procedureType - Document type (SOP, Manual, Guidelines)"
    Write-Host "• effectiveDate - Date from filename"
    Write-Host "• isDraft - Draft status indicator"
    Write-Host "• applicationArea - Business area (Tax, CRM, etc.)"
    Write-Host "• complianceType - Compliance requirements"
    Write-Host "• processCategory - Process type"
    Write-Host "• targetAudience - Who should use this"
    Write-Host "• relatedSystems - Connected systems"
    Write-Host "• updateFrequency - Review cycle"
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to create index" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
