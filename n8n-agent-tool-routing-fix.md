# Fixed Tool Descriptions for Proper Query Routing

## UPDATED TOOL DESCRIPTIONS

### 1. Quick Search Tool
**Name:** `Quick Search`

**Description:**
```
Searches internal DOCUMENTATION and KNOWLEDGE BASE for policies, procedures, SOPs, guides, and technical documentation. DO NOT use this for finding people or employee information. Use this ONLY for: company policies, technical guides, procedure documents, compliance documentation, training materials, and written knowledge resources. NOT for finding who owns/administers something or employee lookups.
```

### 2. Comprehensive Search Tool
**Name:** `Comprehensive Search`

**Description:**
```
Deep semantic search for DOCUMENTS and WRITTEN RESOURCES using AI understanding. Searches policies, procedures, technical documentation, and knowledge articles with context awareness. DO NOT use for finding people, employees, or administrators. Use ONLY when searching for complex documentation, multi-topic resources, or when Quick Search doesn't find enough document results. NOT for employee/people searches.
```

### 3. Entra Users Tool (if you have it)
**Name:** `Entra Users Search` or similar

**Description:**
```
Searches for PEOPLE, EMPLOYEES, and USER INFORMATION in the company directory. Use this when looking for: who owns something, who administers an application, employee contact information, reporting structure, job titles, departments, or any question about specific people or roles. Always use this for "who" questions about people, not documentation searches.
```

---

## ENHANCED PROMPT SECTION TO ADD

Add this to your system prompt to ensure proper tool selection:

```
CRITICAL TOOL SELECTION RULES:

For questions about PEOPLE (who/whom/whose):
- "Who is the administrator of..." → Use Entra Users tool
- "Who owns..." → Use Entra Users tool
- "Who manages..." → Use Entra Users tool
- "Contact for..." → Use Entra Users tool
- "Find [person name]" → Use Entra Users tool
- Any employee lookup → Use Entra Users tool

For questions about DOCUMENTATION (what/how/why):
- "What is the policy for..." → Use Quick Search or Comprehensive Search
- "How do I..." → Use Quick Search or Comprehensive Search
- "Procedure for..." → Use Quick Search or Comprehensive Search
- "Documentation about..." → Use Quick Search or Comprehensive Search
- "Guidelines for..." → Use Quick Search or Comprehensive Search

NEVER use search tools for finding people.
NEVER use Entra for finding documentation.

Decision Tree:
1. Is the user asking about a PERSON or WHO does something?
   → YES: Use Entra Users tool
   → NO: Continue to #2

2. Is the user asking about a DOCUMENT, POLICY, or PROCEDURE?
   → YES: Use Quick Search first, then Comprehensive if needed
   → NO: Continue to #3

3. Is the user asking about general company information?
   → YES: Use your knowledge or Google Search
   → NO: Ask for clarification
```

---

## QUICK FIX FOR COMPREHENSIVE SEARCH

Update the Comprehensive Search code to explicitly reject people queries:

```javascript
// At the beginning of Comprehensive Search tool, add this check:
if (userMessage.toLowerCase().includes('who is') || 
    userMessage.toLowerCase().includes('who are') ||
    userMessage.toLowerCase().includes('administrator') ||
    userMessage.toLowerCase().includes('owner') ||
    userMessage.toLowerCase().includes('manager of')) {
  
  return `<div class="sax-response">
    <div class="greeting">
      <p>Hi ${userProfile.name ? userProfile.name.split(' ')[0] : 'there'}!</p>
    </div>
    <h3>👥 People Search Required</h3>
    <div class="answer-section">
      <p>I need to search our employee directory for that information. Please use the Entra Users tool to find information about people, administrators, or owners.</p>
      <p>The search tools are designed for documentation and policies only.</p>
    </div>
  </div>`;
}
```

---

## TESTING YOUR FIX

After implementing these changes, test with:

**Should go to Entra:**
- "Who is the administrator of this application?"
- "Who owns the Azure subscription?"
- "Find Tom Hughes"
- "Who manages IT?"

**Should go to Search:**
- "What is our password policy?"
- "How do I reset a password?"
- "Azure backup procedures"
- "Compliance documentation"

---

## COMPLETE ROUTING MATRIX

| Query Type | Example | Tool to Use |
|------------|---------|-------------|
| People lookup | "Who is..." | Entra Users |
| Administrator/Owner | "Who administers..." | Entra Users |
| Contact info | "Email for..." | Entra Users |
| Documentation | "Policy for..." | Quick/Comprehensive Search |
| Procedures | "How to..." | Quick/Comprehensive Search |
| Technical guides | "Setup guide..." | Quick/Comprehensive Search |
| Employee by name | "Find John Smith" | Entra Users |
| Department members | "Who works in IT?" | Entra Users |

---

## WHY THIS HAPPENS

The Agent is making this mistake because:
1. The word "administrator" triggers a search for admin documentation
2. Tool descriptions don't explicitly exclude people searches
3. The prompt doesn't have clear routing rules for "who" questions

The fixes above will solve all three issues!