# n8n Agent Tool Descriptions and Prompt Configuration

## TOOL DESCRIPTIONS FOR AGENT

### 1. Quick Search Tool
**Name:** `Quick Search`

**Description:**
```
Performs fast keyword-based search across internal knowledge base. Use this for immediate searches when the user asks about specific topics, policies, procedures, or documentation. Returns relevant keywords and categories for the query. Best for: finding SOPs, policies, employee info, technical documentation, and company resources quickly.
```

**When Agent Should Use It:**
- User asks about company policies or procedures
- Looking for specific documentation
- Need quick keyword matches
- Initial search for any topic

---

### 2. Comprehensive Search Tool  
**Name:** `Comprehensive Search`

**Description:**
```
Performs deep semantic search with AI-powered understanding across all knowledge sources. Use this when Quick Search doesn't find enough results or when the user needs detailed, context-aware information. Analyzes intent, entities, and actions to find the most relevant documents. Returns formatted HTML results with relevance scoring.
```

**When Agent Should Use It:**
- Quick Search returns no/few results
- User needs detailed technical information
- Complex queries requiring semantic understanding
- Multi-concept searches

---

## PROMPT READINESS CHECK ✅

Your system prompt (`n8n-complete-system-prompt.txt`) is **READY** for both search tools! Here's why:

### ✅ Prompt Includes Search Instructions (Lines 127-132):
```
6. Vector Search Tool:
- Search internal knowledge base
- Find relevant SOPs and documentation  
- Retrieve policy documents
- Access training materials
```

### ✅ Search Priority Defined (Lines 181-186):
```
SEARCH PRIORITY:
1. Internal SOPs and documentation (vector search)
2. Entra Users/Groups for employee info
3. SAX Advisory Group website
4. Google Search API for external info
5. Always cite sources
```

### ✅ Tool Usage Instructions (Lines 101-132):
The prompt already tells the AI how to use various tools including search.

---

## ENHANCED PROMPT ADDITION (Optional)

Add this section to your system prompt to make the Agent use both search tools more effectively:

```
SEARCH TOOL USAGE STRATEGY:

When user asks a question requiring information lookup:

1. First attempt: Quick Search
   - Use for: Policies, procedures, employee info, technical docs
   - Expected response time: <1 second
   - If results found: Present them with the answer

2. If Quick Search returns insufficient results: Comprehensive Search
   - Use for: Complex queries, multi-concept searches, semantic understanding
   - Analyzes: Intent, entities, actions, department context
   - Returns: Scored results with relevance percentages

3. Search Enhancement Rules:
   - For IT users: Prioritize technical documentation
   - For Finance users: Prioritize financial policies and GAAP docs
   - For HR users: Prioritize employee handbooks and policies
   - Always personalize search based on user's department

4. Result Presentation:
   - Show top 3-5 most relevant results
   - Include relevance scores
   - Cite sources clearly
   - If no results: Offer to search external sources
```

---

## IMPLEMENTATION CHECKLIST

### For Quick Search Tool:
- [ ] Add as Code node in Agent tools
- [ ] Set name: "Quick Search"
- [ ] Add description (provided above)
- [ ] Paste code from `n8n-quick-search-node.js`
- [ ] Test with sample query

### For Comprehensive Search Tool:
- [ ] Add as Code node in Agent tools  
- [ ] Set name: "Comprehensive Search"
- [ ] Add description (provided above)
- [ ] Paste code from `n8n-comprehensive-search-tool-fixed.js`
- [ ] Ensure it returns string (not object)
- [ ] Test with complex query

### Agent Configuration:
- [ ] System prompt includes search instructions ✅
- [ ] Tools are connected to Agent
- [ ] Memory node has sessionId ✅
- [ ] Context node passes userProfile ✅
- [ ] Response formatter handles HTML output

---

## TESTING PHRASES

Test your Agent with these queries to verify search tools work:

**Quick Search Tests:**
- "What's our password reset policy?"
- "Find Azure VM documentation"
- "Show me employee onboarding procedures"

**Comprehensive Search Tests:**
- "How do I configure Azure AD with MFA for new employees?"
- "What are the financial reporting requirements for Q4?"
- "Explain our security compliance procedures for HIPAA"

**Department-Specific Tests (for Tom - IT):**
- "Show me our backup procedures" → Should prioritize IT docs
- "What's our incident response process?" → Should find security docs
- "How do we provision new user accounts?" → Should return IT procedures

---

## EXPECTED BEHAVIOR

When configured correctly:

1. **User asks:** "What's our password policy?"

2. **Agent thinks:** "Need to search for password policy"

3. **Agent calls:** Quick Search tool first

4. **Quick Search returns:** Keywords extracted, categories identified

5. **If good results:** Agent presents them with greeting "Hi Tom!"

6. **If insufficient:** Agent calls Comprehensive Search

7. **Final response:** HTML formatted with personalized greeting and relevant documents

Your prompt is ready! Just add the tool descriptions and test.