# n8n Two-Node Search Architecture Setup Guide

## Overview
This two-node architecture dramatically improves search performance from 30 seconds to 1-2 seconds by splitting the search into two specialized operations:

1. **Node 1: Quick Search** - Returns in 1-2 seconds with metadata
2. **Node 2: Content Fetcher** - Loads full document content on demand (when AI needs it)

## Performance Comparison

| Metric | Old Single Node | New Two-Node System |
|--------|----------------|---------------------|
| Initial Response | ~30 seconds | 1-2 seconds |
| User Experience | Long wait | Instant feedback |
| AI Context | All content upfront | Metadata first, content on demand |
| Resource Usage | High | Optimized |

## Setting Up in n8n

### Step 1: Create the Quick Search Node
1. Add a new **Code Node** in n8n
2. Name it: `Quick Search`
3. Copy the entire contents of `n8n-node1-quick-search.js`
4. Set the language to: `JavaScript`
5. Input: Expects `{ "query": "user search term" }`

### Step 2: Create the Content Fetcher Node
1. Add another **Code Node** in n8n
2. Name it: `Content Fetcher`
3. Copy the entire contents of `n8n-node2-content-fetcher.js`
4. Set the language to: `JavaScript`
5. Input options:
   - By ID: `{ "documentIds": ["doc1-id", "doc2-id"] }`
   - By Title: `{ "documentTitles": ["Document Title 1"] }`

### Step 3: AI Agent Configuration

Configure your AI agent with this logic:

```javascript
// In your AI agent's tool/function calling logic:

1. When user searches for documents:
   - Call "Quick Search" node
   - Display results immediately to user
   - Store document IDs in context

2. When user asks specific questions about a document:
   - Check if document content already loaded
   - If not, call "Content Fetcher" node with document ID
   - Use full content to answer detailed questions

3. Example flow:
   User: "Show me HubSpot documents"
   -> Quick Search returns list in 1-2 seconds
   
   User: "How do I create a deal in HubSpot?"
   -> Content Fetcher loads specific HubSpot SOP
   -> AI answers with full context
```

## Workflow Example

### Basic Search Workflow
```
[Trigger] → [Quick Search] → [AI Response]
    ↓
[User asks detail] → [Content Fetcher] → [AI Detailed Response]
```

### Advanced Workflow with Conditional Logic
```
[Trigger] 
    ↓
[Quick Search]
    ↓
[Switch Node]
    ├─ If user wants list only → [Format & Display]
    └─ If user asks specific question → [Content Fetcher] → [AI Process] → [Detailed Answer]
```

## Node 1: Quick Search Features
- **Response Time**: 1-2 seconds
- **Query Types**: Keywords, "all", wildcards
- **Returns**:
  - Document metadata (title, department, type, version)
  - Brief descriptions
  - Keywords/tags
  - Document IDs for later retrieval
- **Timeout**: 2 seconds (fails gracefully)

## Node 2: Content Fetcher Features
- **Response Time**: 3-8 seconds (only when needed)
- **Input Methods**:
  - Document IDs (preferred - exact match)
  - Document Titles (fallback - fuzzy match)
- **Returns**:
  - Full document content
  - Extracted text
  - Complete metadata
  - AI-ready context
- **Timeout**: 8 seconds

## Best Practices

### 1. Always Start with Quick Search
- Provides instant feedback to users
- Reduces perceived wait time
- Allows AI to understand available documents

### 2. Load Content Strategically
- Only fetch content when user asks specific questions
- Cache loaded content in conversation context
- Batch fetch multiple documents if needed

### 3. Error Handling
Both nodes include graceful error handling:
- Timeouts return user-friendly messages
- Fallback to simpler search methods
- Clear error messages for debugging

### 4. AI Integration Tips
```javascript
// Example AI prompt template:
const aiPrompt = `
Available Documents (from Quick Search):
${quickSearchResults.documents.map(d => `- ${d.title}: ${d.description}`).join('\n')}

User Question: ${userQuestion}

If you need detailed content from any document to answer this question,
indicate which document(s) you need by returning:
NEED_CONTENT: [document_ids]

Otherwise, answer based on available information.
`;
```

## Testing the Nodes

### Test Quick Search:
```json
// Input:
{
  "query": "hubspot"
}

// Expected output (in 1-2 seconds):
{
  "success": true,
  "documents": [...],
  "displayHtml": "...",
  "totalCount": 5
}
```

### Test Content Fetcher:
```json
// Input:
{
  "documentIds": ["doc-123-abc"]
}

// Expected output:
{
  "success": true,
  "documentsLoaded": 1,
  "aiContext": [{ 
    "title": "...",
    "content": "Full document text..."
  }]
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Slow initial response | Check Quick Search is using `simple` query type |
| Content not loading | Verify document IDs are correct |
| Timeouts | Increase timeout values if network is slow |
| No results | Check search index and API key |

## Migration from Old System

1. Keep old node as backup
2. Test new nodes with sample queries
3. Update AI agent logic to use two-node system
4. Monitor performance improvements
5. Remove old node once stable

## Performance Metrics

Monitor these KPIs:
- Quick Search response time (target: <2 seconds)
- Content fetch time (target: <8 seconds)
- User satisfaction (reduced "waiting" messages)
- AI response quality (same or better with full content)

## Future Optimizations

Consider these enhancements:
1. Add caching layer for frequently accessed documents
2. Implement content pre-fetching for predicted documents
3. Add semantic ranking to Quick Search results
4. Create specialized nodes for different document types