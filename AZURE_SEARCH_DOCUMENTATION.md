# Azure AI Search Index Documentation - SAX MegaMind

## 🔍 Overview
This document provides comprehensive documentation of all Azure AI Search indexes used by SAX MegaMind, including their features, fields, vectorization, and configurations.

---

## 📊 Search Service Details

**Service Name:** `saxmegamind-search`  
**Resource Group:** `SAXTech-AI`  
**API Version:** `2023-11-01`  
**Region:** East US 2

---

## 📚 Indexes Overview

### 1. **auditorpublic**
**Purpose:** Public audit documentation and compliance materials  
**Use Case:** Searching audit procedures, compliance requirements, and regulatory guidance

### 2. **ld-documents**
**Purpose:** Learning & Development documents  
**Use Case:** Training materials, educational content, professional development resources

### 3. **sop-documents**
**Purpose:** Standard Operating Procedures  
**Use Case:** Company procedures, operational guidelines, process documentation

### 4. **ustaxpublic**
**Purpose:** US Tax public documentation  
**Use Case:** Tax forms, IRS publications, tax code references, filing instructions

---

## 🎯 Index Features & Capabilities

### Vector Search Configuration

#### **Embedding Model**
- **Model:** `text-embedding-3-small`
- **Provider:** Azure OpenAI
- **Dimensions:** 1536
- **Deployment:** `saxmegamindopenai.openai.azure.com`

#### **Algorithm**
```json
{
  "name": "hnsw-algorithm",
  "kind": "hnsw",
  "hnswParameters": {
    "metric": "cosine",
    "m": 4,
    "efConstruction": 400,
    "efSearch": 500
  }
}
```

#### **Vectorizer Configuration**
```json
{
  "name": "openai-text-embedding-3-small",
  "kind": "azureOpenAI",
  "azureOpenAIParameters": {
    "resourceUri": "https://saxmegamindopenai.openai.azure.com",
    "deploymentId": "text-embedding-3-small",
    "modelName": "text-embedding-3-small"
  }
}
```

### Semantic Search Configuration

Each index includes semantic search with:
- **Title Field Priority**: Identifies the main title/name field
- **Content Fields**: Primary content for semantic understanding
- **Keyword Fields**: Tags, categories for enhanced matching

```json
{
  "configurations": [{
    "name": "semantic-config",
    "prioritizedFields": {
      "titleField": {"fieldName": "title"},
      "prioritizedContentFields": [
        {"fieldName": "content"},
        {"fieldName": "summary"}
      ],
      "prioritizedKeywordsFields": [
        {"fieldName": "tags"},
        {"fieldName": "keywords"}
      ]
    }
  }]
}
```

### Scoring Profiles

#### **Relevance Boost Profile**
Weights important fields for better relevance:
- Title: 3x weight
- Content: 2x weight  
- Tags: 1.5x weight

#### **Freshness Profile**
Boosts recent content:
- Boost Factor: 2x
- Duration: 30 days
- Interpolation: Linear

---

## 📋 Common Fields Across Indexes

### Text Fields
| Field Name | Type | Searchable | Filterable | Facetable | Normalizer |
|------------|------|------------|------------|-----------|------------|
| id | Edm.String | ✅ | ✅ | ❌ | - |
| title | Edm.String | ✅ | ✅ | ❌ | - |
| content | Edm.String | ✅ | ❌ | ❌ | - |
| summary | Edm.String | ✅ | ❌ | ❌ | - |
| tags | Collection(Edm.String) | ✅ | ✅ | ✅ | lowercase |
| keywords | Collection(Edm.String) | ✅ | ✅ | ✅ | lowercase |
| category | Edm.String | ✅ | ✅ | ✅ | lowercase |

### Vector Fields
| Field Name | Type | Dimensions | Vector Profile |
|------------|------|------------|----------------|
| contentVector | Collection(Edm.Single) | 1536 | vector-profile |
| titleVector | Collection(Edm.Single) | 1536 | vector-profile |
| summaryVector | Collection(Edm.Single) | 1536 | vector-profile |

### Metadata Fields
| Field Name | Type | Purpose |
|------------|------|---------|
| lastModified | Edm.DateTimeOffset | Freshness scoring |
| createdDate | Edm.DateTimeOffset | Date filtering |
| author | Edm.String | Attribution |
| source | Edm.String | Document origin |

---

## 🔧 Normalizer Configuration

### Valid Normalizers
- **standard**: Standard Unicode normalization
- **lowercase**: Converts to lowercase for case-insensitive filtering
- **uppercase**: Converts to uppercase
- **asciifolding**: Removes diacritics/accents

### Applied Rules
- Filterable string fields use `lowercase` normalizer
- Searchable fields don't use normalizers (handled by analyzers)
- Key fields never use normalizers

---

## 🚀 Search Capabilities

### 1. **Hybrid Search**
Combines keyword and vector search for optimal results:
```javascript
// Example query structure
{
  search: "tax deductions",
  vectors: [{
    value: [/* embedding array */],
    fields: "contentVector",
    k: 10
  }],
  queryType: "hybrid"
}
```

### 2. **Semantic Search**
Natural language understanding with reranking:
```javascript
{
  search: "How do I file quarterly taxes?",
  queryType: "semantic",
  semanticConfiguration: "semantic-config",
  answers: "extractive|3"
}
```

### 3. **Faceted Search**
Filter and categorize results:
```javascript
{
  search: "*",
  facets: ["category", "tags", "source"],
  filter: "category eq 'tax-forms'"
}
```

### 4. **Vector Search**
Pure similarity search using embeddings:
```javascript
{
  vectors: [{
    value: embeddingArray,
    fields: "contentVector",
    k: 20
  }]
}
```

---

## 🔌 Integration with N8N

### Webhook Integration
The CPA profile uses webhook: `https://workflows.saxtechnology.com/webhook/megamind-cpa`

### N8N Workflow Components
1. **Query Processing**: Receives user query from chat
2. **Embedding Generation**: Creates embeddings using text-embedding-3-small
3. **Index Search**: Queries appropriate index based on context
4. **Result Processing**: Formats and returns relevant documents
5. **Response Generation**: Combines search results with AI response

### Search Pipeline in N8N
```
User Query → Embedding → Vector Search → Semantic Rerank → Format Results → AI Response
```

---

## 📈 Performance Optimizations

### Index Optimizations
- **Partitioning**: Automatic based on index size
- **Replicas**: Configured for high availability
- **Cache**: Query results cached for common searches

### Search Optimizations
- **Top K**: Limited to relevant results (typically 10-20)
- **Minimum Score**: Filters low-relevance results
- **Field Selection**: Returns only needed fields

### Vector Search Optimizations
- **HNSW Parameters**:
  - M=4: Balance between accuracy and speed
  - efConstruction=400: Build-time quality
  - efSearch=500: Query-time accuracy

---

## 🛠️ Maintenance Scripts

### Fix All Indexes
```bash
python fix-all-search-indexes.py
```
- Fixes normalizer issues
- Adds vectorizers
- Configures semantic search
- Adds scoring profiles

### Backup Indexes
```bash
# Automatic backups created before updates
backup-{index-name}-{timestamp}.json
```

### Monitor Health
```bash
az search service show \
  --name saxmegamind-search \
  --resource-group SAXTech-AI
```

---

## 📊 Index-Specific Details

### auditorpublic
- **Document Count**: Variable
- **Primary Use**: Audit procedures and compliance
- **Key Fields**: procedure_name, compliance_area, risk_level
- **Special Features**: Risk scoring, compliance tracking

### ld-documents
- **Document Count**: Variable
- **Primary Use**: Training and development
- **Key Fields**: course_title, skill_level, duration
- **Special Features**: Skill tagging, progress tracking

### sop-documents
- **Document Count**: Variable
- **Primary Use**: Standard procedures
- **Key Fields**: procedure_id, department, version
- **Special Features**: Version control, department filtering

### ustaxpublic
- **Document Count**: Variable
- **Primary Use**: Tax documentation
- **Key Fields**: form_number, tax_year, filing_status
- **Special Features**: Year filtering, form categorization

---

## 🔐 Security & Access

### Authentication
- **Method**: API Key (Admin/Query keys)
- **Storage**: Azure Key Vault
- **Rotation**: Regular key rotation policy

### Network Security
- **Firewall**: IP restrictions configured
- **Private Endpoints**: Available for production
- **TLS**: All communications encrypted

### Data Security
- **Encryption at Rest**: AES-256
- **Encryption in Transit**: TLS 1.2+
- **Backup**: Regular automated backups

---

## 📈 Monitoring & Analytics

### Key Metrics
- Query latency (target: <100ms)
- Index size and document count
- Query volume and patterns
- Error rates and types

### Logging
- Query logs for analysis
- Error logs for debugging
- Performance metrics tracking
- Usage analytics

---

## 🚨 Troubleshooting

### Common Issues

#### 1. **Normalizer Errors**
**Error:** "Invalid normalizer configuration"
**Solution:** Run `fix-all-search-indexes.py`

#### 2. **Missing Vectorizer**
**Error:** "No vectorizer configured"
**Solution:** Ensure text-embedding-3-small deployment exists

#### 3. **Semantic Search Not Working**
**Error:** "Semantic configuration not found"
**Solution:** Check semantic config in index schema

#### 4. **Poor Search Results**
**Issue:** Relevance issues
**Solution:** Adjust scoring profiles and weights

---

## 📝 Best Practices

### Query Optimization
1. Use hybrid search for best results
2. Implement query suggestion/autocomplete
3. Cache frequent queries
4. Use filters to narrow results

### Index Management
1. Regular index optimization
2. Monitor index size and performance
3. Implement data retention policies
4. Regular backups before changes

### Vector Search
1. Keep embeddings up to date
2. Monitor embedding model changes
3. Test different k values for optimal results
4. Consider dimension reduction for large indexes

---

## 🔄 Update History

| Date | Changes |
|------|---------|
| 2025-09-18 | Initial configuration with text-embedding-3-small |
| 2025-09-18 | Added semantic search configurations |
| 2025-09-18 | Fixed normalizer issues |
| 2025-09-18 | Added scoring profiles |

---

*Last Updated: September 18, 2025*  
*Version: 2.0*