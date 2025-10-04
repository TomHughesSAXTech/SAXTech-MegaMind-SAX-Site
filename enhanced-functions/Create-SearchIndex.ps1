# SAXMegaMind Documents - Create Azure Search Index
# Copyright (c) 2024 SAXTech

param(
    [Parameter(Mandatory=$true)]
    [string]$SearchServiceName,
    
    [Parameter(Mandatory=$true)]
    [string]$SearchApiKey,
    
    [string]$IndexName = "saxdocuments"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "SAXMegaMind Documents" -ForegroundColor Cyan
Write-Host "Create Azure Search Index" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$searchEndpoint = "https://$SearchServiceName.search.windows.net"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "--------------" -ForegroundColor Yellow
Write-Host "Search Service: $SearchServiceName"
Write-Host "Index Name: $IndexName"
Write-Host "Endpoint: $searchEndpoint"
Write-Host ""

# Define the index schema
$indexSchema = @{
    name = $IndexName
    fields = @(
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
            name = "modifiedBy"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "language"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "confidentiality"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $true
            retrievable = $true
        },
        @{
            name = "retentionPeriod"
            type = "Edm.String"
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "expiryDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
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
        },
        @{
            name = "deletedDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "deletedBy"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "deleteReason"
            type = "Edm.String"
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
            retrievable = $true
        },
        @{
            name = "restoredDate"
            type = "Edm.DateTimeOffset"
            searchable = $false
            filterable = $true
            sortable = $true
            facetable = $false
            retrievable = $true
        },
        @{
            name = "restoredBy"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
            retrievable = $true
        }
    )
    suggesters = @(
        @{
            name = "sg"
            searchMode = "analyzingInfixMatching"
            sourceFields = @("title", "description", "fileName", "author")
        }
    )
    scoringProfiles = @()
    corsOptions = @{
        allowedOrigins = @("*")
        maxAgeInSeconds = 300
    }
}

$headers = @{
    "api-key" = $SearchApiKey
    "Content-Type" = "application/json"
}

# Check if index already exists
Write-Host "Checking if index exists..." -ForegroundColor Yellow
$checkUri = "$searchEndpoint/indexes/$($IndexName)?api-version=2023-11-01"

try {
    $existingIndex = Invoke-RestMethod -Uri $checkUri -Headers $headers -Method Get -ErrorAction SilentlyContinue
    
    if ($existingIndex) {
        Write-Host "Index '$IndexName' already exists" -ForegroundColor Yellow
        $response = Read-Host "Do you want to delete and recreate it? (y/n)"
        
        if ($response -eq 'y') {
            Write-Host "Deleting existing index..." -ForegroundColor Yellow
            $deleteUri = "$searchEndpoint/indexes/$($IndexName)?api-version=2023-11-01"
            Invoke-RestMethod -Uri $deleteUri -Headers $headers -Method Delete
            Write-Host "Waiting for deletion to complete..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
        else {
            Write-Host "Index creation cancelled" -ForegroundColor Red
            exit 0
        }
    }
}
catch {
    # Index doesn't exist, continue with creation
}

# Create the index
Write-Host "Creating index '$IndexName'..." -ForegroundColor Yellow
$createUri = "$searchEndpoint/indexes?api-version=2023-11-01"

try {
    $response = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body (ConvertTo-Json $indexSchema -Depth 10)
    
    Write-Host "✓ Index '$IndexName' created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Index Details:" -ForegroundColor Cyan
    Write-Host "--------------" -ForegroundColor Cyan
    Write-Host "• 34 fields configured"
    Write-Host "• Full-text search on: title, description, content, keywords"
    Write-Host "• Filterable by: department, documentType, status, dates"
    Write-Host "• Facets for: department, documentType, keywords, tags"
    Write-Host "• Autocomplete suggester configured"
    Write-Host "• CORS enabled for all origins"
    Write-Host ""
    Write-Host "You can now:" -ForegroundColor Green
    Write-Host "1. Start uploading documents using the DocumentUpload function"
    Write-Host "2. Search documents using the DocumentSearch function"
    Write-Host "3. View the index in Azure Portal"
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to create index" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
