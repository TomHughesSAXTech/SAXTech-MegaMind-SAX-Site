# Fix for Entra Users Tool Returning Multiple Accounts

## The Issue
When searching for users, the Entra Users tool sometimes returns multiple accounts (duplicates, service accounts, etc.) and the AI doesn't properly handle showing all results.

## Solutions

### Option 1: Update the AI Agent's System Prompt
Add this to your Megamind SAX SAGE agent's system message:

```
When the Entra Users tool returns multiple accounts:
1. List ALL accounts found with their details
2. Show each account's:
   - Display Name
   - Job Title  
   - Department
   - Company
   - Email
   - Mobile Phone (if available)
   - Business Phone (if available)
   - Which account appears to be the primary/active one
3. If accounts have different information (one has mobile, another has business phone), combine the information and note which came from which account
```

### Option 2: Modify the Entra Users Tool Filter
Update the filter in the Entra Users tool to be more specific:

Instead of just searching by displayName, use:
```
Filter: startswith(displayName,'Bob Owen') and accountEnabled eq true
```

Or filter out service accounts:
```
Filter: startswith(displayName,'Bob Owen') and not startswith(userPrincipalName,'svc')
```

### Option 3: Add Email Domain Filter
If you want to only get the primary corporate accounts:
```
Filter: startswith(displayName,'Bob Owen') and endswith(mail,'@saxtechnology.com')
```

### Option 4: Create a Code Node to Deduplicate
Add a Code node after the Entra Users tool that:
1. Combines duplicate accounts
2. Merges their phone numbers
3. Picks the one with the most complete data

```javascript
// Example deduplication code
const users = $json.response || $json;
const uniqueUsers = {};

users.forEach(user => {
  const key = user.displayName || user.mail;
  if (!uniqueUsers[key] || 
      (user.mobilePhone && !uniqueUsers[key].mobilePhone) ||
      (user.businessPhones?.length > 0 && !uniqueUsers[key].businessPhones?.length)) {
    // Merge data from multiple accounts
    uniqueUsers[key] = {
      ...uniqueUsers[key],
      ...user,
      mobilePhone: uniqueUsers[key]?.mobilePhone || user.mobilePhone,
      businessPhones: [...(uniqueUsers[key]?.businessPhones || []), ...(user.businessPhones || [])]
    };
  }
});

return Object.values(uniqueUsers);
```

## Why This Happens
Common reasons for duplicate accounts in Entra/Azure AD:
1. **Migration artifacts** - Old accounts from system migrations
2. **Service accounts** - Accounts created for specific services
3. **Test accounts** - Development or testing accounts
4. **Sync issues** - Problems with AD Connect or cloud sync
5. **Manual duplicates** - Accidentally created duplicate accounts

## Recommended Fix
1. First, update the AI agent's prompt to handle multiple results better
2. Then work with your IT team to clean up duplicate accounts in Azure AD
3. Consider adding accountEnabled filter to only show active accounts