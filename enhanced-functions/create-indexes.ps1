# SAXMegaMind Documents - Create All Search Indexes
# Copyright (c) 2024 SAXTech

param(
    [string]$SearchServiceName = "saxmegamind-search",
    [string]$ResourceGroup = "SAXTech-AI"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "SAXMegaMind Document System" -ForegroundColor Cyan
Write-Host "Creating Search Indexes" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get the search API key
Write-Host "Getting search API key..." -ForegroundColor Yellow
$SearchApiKey = "sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO"
$searchEndpoint = "https://$SearchServiceName.search.windows.net"

$headers = @{
    "api-key" = $SearchApiKey
    "Content-Type" = "application/json"
}

# Define all indexes
$indexes = @(
    @{
        name = "saxdocuments"
        description = "Main document index with comprehensive metadata"
    },
    @{
        name = "sop-documents"  
        description = "SOP-specific document index with enhanced fields"
    },
    @{
        name = "megamind-documents-v3"
        description = "Advanced document index with semantic search"
    },
    @{
        name = "megamind-vectors-v3"
        description = "Vector search index for document chunks"
    }
)

# Index 1: saxdocuments (Main Index)
$saxdocumentsSchema = @{
    name = "saxdocuments"
    fields = @(
        @{name = "id"; type = "Edm.String"; key = $true; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "title"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $true; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "description"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "content"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "department"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $true; facetable = $true; retrievable = $true},
        @{name = "documentType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $true; facetable = $true; retrievable = $true},
        @{name = "author"; type = "Edm.String"; searchable = $true; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "keywords"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "tags"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "status"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "version"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "lastModified"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "createdDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "fileSize"; type = "Edm.Int64"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "fileType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "fileName"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "blobUrl"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "blobName"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "containerName"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "uploadedBy"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "modifiedBy"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "language"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "confidentiality"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "retentionPeriod"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "expiryDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "reviewDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "approvedBy"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "approvalDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "deletedDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "deletedBy"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "deleteReason"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "restoredDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "restoredBy"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true}
    )
    suggesters = @(
        @{
            name = "sg"
            searchMode = "analyzingInfixMatching"
            sourceFields = @("title", "fileName", "author", "description")
        }
    )
    scoringProfiles = @()
    corsOptions = @{
        allowedOrigins = @("*")
        maxAgeInSeconds = 300
    }
}

# Index 2: sop-documents (SOP Enhanced)
$sopDocumentsSchema = @{
    name = "sop-documents"
    fields = $saxdocumentsSchema.fields + @(
        @{name = "systemName"; type = "Edm.String"; searchable = $true; filterable = $true; sortable = $true; facetable = $true; retrievable = $true},
        @{name = "procedureType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "effectiveDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "isDraft"; type = "Edm.Boolean"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "applicationArea"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "complianceType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "processCategory"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "targetAudience"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "relatedSystems"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "updateFrequency"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true}
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

# Index 3: megamind-documents-v3 (Advanced with Semantic)
$megamindDocumentsSchema = @{
    name = "megamind-documents-v3"
    fields = @(
        @{name = "id"; type = "Edm.String"; key = $true; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "fileName"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "fileType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "documentType"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "department"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "title"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "description"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "keywords"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "version"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "uploadDate"; type = "Edm.DateTimeOffset"; searchable = $false; filterable = $true; sortable = $true; facetable = $false; retrievable = $true},
        @{name = "blobUrl"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "blobUrlSecondary"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "blobUrlArchive"; type = "Edm.String"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "summary"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "sentiment"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "keyPhrases"; type = "Collection(Edm.String)"; searchable = $true; filterable = $false; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "entities"; type = "Collection(Edm.String)"; searchable = $true; filterable = $false; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "topics"; type = "Collection(Edm.String)"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true},
        @{name = "fileHash"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "extractedText"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "pages"; type = "Edm.Int32"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "language"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $true; retrievable = $true}
    )
    suggesters = @(
        @{
            name = "sg"
            searchMode = "analyzingInfixMatching"
            sourceFields = @("fileName", "title", "keywords")
        }
    )
    scoringProfiles = @(
        @{
            name = "recent_first"
            text = @{
                weights = @{
                    title = 2.0
                    keywords = 1.5
                    extractedText = 1.0
                }
            }
            functions = @(
                @{
                    type = "freshness"
                    fieldName = "uploadDate"
                    boost = 2
                    interpolation = "linear"
                    freshness = @{
                        boostingDuration = "P365D"
                    }
                }
            )
        }
    )
    corsOptions = @{
        allowedOrigins = @("*")
        maxAgeInSeconds = 300
    }
}

# Process each index
$createdIndexes = @()
$failedIndexes = @()

foreach ($indexDef in @($saxdocumentsSchema, $sopDocumentsSchema, $megamindDocumentsSchema)) {
    $indexName = $indexDef.name
    Write-Host "Processing index: $indexName" -ForegroundColor Yellow
    
    # Check if index exists
    $checkUri = "$searchEndpoint/indexes/$($indexName)?api-version=2023-11-01"
    
    try {
        $existingIndex = Invoke-RestMethod -Uri $checkUri -Headers $headers -Method Get -ErrorAction SilentlyContinue
        
        if ($existingIndex) {
            Write-Host "  Index '$indexName' already exists, deleting..." -ForegroundColor Yellow
            $deleteUri = "$searchEndpoint/indexes/$($indexName)?api-version=2023-11-01"
            Invoke-RestMethod -Uri $deleteUri -Headers $headers -Method Delete
            Start-Sleep -Seconds 3
        }
    }
    catch {
        # Index doesn't exist, continue
    }
    
    # Create the index
    Write-Host "  Creating index '$indexName'..." -ForegroundColor Yellow
    $createUri = "$searchEndpoint/indexes?api-version=2023-11-01"
    
    try {
        $response = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body (ConvertTo-Json $indexDef -Depth 10)
        Write-Host "  ✓ Index '$indexName' created successfully!" -ForegroundColor Green
        $createdIndexes += $indexName
    }
    catch {
        Write-Host "  ✗ Failed to create index '$indexName'" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        $failedIndexes += $indexName
    }
    
    Start-Sleep -Seconds 2
}

# Create vector index with special configuration
Write-Host "Processing vector index: megamind-vectors-v3" -ForegroundColor Yellow

$vectorIndexSchema = @{
    name = "megamind-vectors-v3"
    fields = @(
        @{name = "id"; type = "Edm.String"; key = $true; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "parentId"; type = "Edm.String"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "chunkIndex"; type = "Edm.Int32"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "content"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true; analyzer = "standard.lucene"},
        @{name = "startOffset"; type = "Edm.Int32"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "endOffset"; type = "Edm.Int32"; searchable = $false; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "keyPhrases"; type = "Collection(Edm.String)"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "entities"; type = "Collection(Edm.String)"; searchable = $true; filterable = $false; sortable = $false; facetable = $false; retrievable = $true},
        @{name = "wordCount"; type = "Edm.Int32"; searchable = $false; filterable = $true; sortable = $false; facetable = $false; retrievable = $true}
    )
    corsOptions = @{
        allowedOrigins = @("*")
        maxAgeInSeconds = 300
    }
}

# Check and create vector index
$checkUri = "$searchEndpoint/indexes/megamind-vectors-v3?api-version=2023-11-01"

try {
    $existingIndex = Invoke-RestMethod -Uri $checkUri -Headers $headers -Method Get -ErrorAction SilentlyContinue
    
    if ($existingIndex) {
        Write-Host "  Index 'megamind-vectors-v3' already exists, deleting..." -ForegroundColor Yellow
        $deleteUri = "$searchEndpoint/indexes/megamind-vectors-v3?api-version=2023-11-01"
        Invoke-RestMethod -Uri $deleteUri -Headers $headers -Method Delete
        Start-Sleep -Seconds 3
    }
}
catch {
    # Index doesn't exist, continue
}

Write-Host "  Creating vector index 'megamind-vectors-v3'..." -ForegroundColor Yellow
$createUri = "$searchEndpoint/indexes?api-version=2023-11-01"

try {
    $response = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body (ConvertTo-Json $vectorIndexSchema -Depth 10)
    Write-Host "  ✓ Index 'megamind-vectors-v3' created successfully!" -ForegroundColor Green
    $createdIndexes += "megamind-vectors-v3"
}
catch {
    Write-Host "  ✗ Failed to create index 'megamind-vectors-v3'" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
    $failedIndexes += "megamind-vectors-v3"
}

# Summary
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Index Creation Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

if ($createdIndexes.Count -gt 0) {
    Write-Host "✓ Successfully created indexes:" -ForegroundColor Green
    foreach ($idx in $createdIndexes) {
        Write-Host "  • $idx" -ForegroundColor Green
    }
}

if ($failedIndexes.Count -gt 0) {
    Write-Host ""
    Write-Host "✗ Failed to create indexes:" -ForegroundColor Red
    foreach ($idx in $failedIndexes) {
        Write-Host "  • $idx" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Index Features:" -ForegroundColor Cyan
Write-Host "• saxdocuments - Main document storage with 34 fields" -ForegroundColor White
Write-Host "• sop-documents - Enhanced with 10 SOP-specific fields" -ForegroundColor White
Write-Host "• megamind-documents-v3 - Advanced with semantic search capabilities" -ForegroundColor White
Write-Host "• megamind-vectors-v3 - Vector search for document chunks" -ForegroundColor White
Write-Host ""
Write-Host "All indexes configured with:" -ForegroundColor Yellow
Write-Host "• Full-text search capabilities" -ForegroundColor White
Write-Host "• Faceting for filters" -ForegroundColor White
Write-Host "• Autocomplete suggesters" -ForegroundColor White
Write-Host "• CORS enabled for all origins" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "1. Upload test documents to verify indexing" -ForegroundColor White
Write-Host "2. Configure Application Insights monitoring" -ForegroundColor White
Write-Host "3. Test search queries from the frontend" -ForegroundColor White
