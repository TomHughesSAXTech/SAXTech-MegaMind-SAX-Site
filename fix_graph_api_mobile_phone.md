# Fix for Microsoft Graph API Not Returning Mobile Phone

## The Problem
Microsoft Graph API is returning `mobilePhone: null` even though the mobile phone is set in your Azure AD account.

## Root Causes & Solutions

### 1. **Check Azure AD Mobile Phone Field**
The mobile phone might be stored in a different field in Azure AD. Check these locations:

1. **Azure Portal**:
   - Go to portal.azure.com
   - Navigate to Azure Active Directory > Users > Tom Hughes
   - Check both:
     - **Profile** section → Mobile phone
     - **Authentication methods** → Phone

2. **Microsoft 365 Admin Center**:
   - Go to admin.microsoft.com
   - Users > Active users > Tom Hughes
   - Check the mobile phone field

### 2. **Update Your Graph API Call**
The mobile phone might be in a different property. Update your frontend code to request additional fields:

```javascript
// In your frontend index.html or auth.js file, update the Graph API call:

async function getUserProfile(accessToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,companyName,businessPhones,mobilePhone,city,state,country,manager,otherMails,proxyAddresses,onPremisesMobilePhone', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const profile = await response.json();
    
    // Check multiple possible mobile phone fields
    const mobilePhone = profile.mobilePhone || 
                       profile.onPremisesMobilePhone || 
                       profile.businessPhones?.[1] || // Sometimes mobile is second business phone
                       null;
    
    // Merge the mobile phone into the profile
    profile.mobilePhone = mobilePhone;
    
    return profile;
}
```

### 3. **Check API Permissions**
Ensure your app registration has the right permissions:

1. Go to Azure Portal > App registrations > MegaMind SAX Portal
2. Check API permissions for:
   - `User.Read` (minimum)
   - `User.ReadBasic.All` (if reading other users)
   - `Directory.Read.All` (for complete profile data)

### 4. **Use Authentication Methods API**
If mobile phone is stored as an authentication method, you need a different API:

```javascript
// Get authentication methods (requires additional permissions)
async function getUserAuthMethods(accessToken, userId) {
    try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/authentication/phoneMethods`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const methods = await response.json();
            // Look for mobile phone in auth methods
            const mobileMethod = methods.value?.find(m => m.phoneType === 'mobile');
            return mobileMethod?.phoneNumber || null;
        }
    } catch (error) {
        console.error('Failed to get auth methods:', error);
    }
    return null;
}
```

### 5. **Check Extended Properties**
Sometimes mobile phone is in extended properties:

```javascript
// Try getting extended properties
async function getExtendedProfile(accessToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=*', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const profile = await response.json();
    console.log('All available properties:', Object.keys(profile));
    return profile;
}
```

## Quick Fix for Your n8n Workflow

While you're fixing the Graph API issue, you can add a fallback in your n8n node to handle missing mobile phones:

```javascript
// In your Prepare Context and Route node, add this after extracting userProfile:

// Fallback for mobile phone if Graph API doesn't return it
if (!userProfile.mobilePhone && userProfile.businessPhones?.length > 1) {
    // Sometimes mobile is stored as second business phone
    userProfile.mobilePhone = userProfile.businessPhones[1];
}

// Or if you know your mobile number, temporarily hardcode it for your user:
if (userProfile.email === 'thughes@saxadvisorygroup.com' && !userProfile.mobilePhone) {
    // Temporary fix - replace with your actual mobile
    userProfile.mobilePhone = 'YOUR-MOBILE-NUMBER-HERE';
}
```

## Debugging Steps

1. **Check what Graph API actually returns**:
```javascript
// Add this to your frontend to see all fields:
console.log('Raw Graph API response:', JSON.stringify(profile, null, 2));
```

2. **Use Graph Explorer**:
   - Go to https://developer.microsoft.com/en-us/graph/graph-explorer
   - Sign in with your account
   - Run query: `GET https://graph.microsoft.com/v1.0/me`
   - Check if mobilePhone appears

3. **Check Profile Completeness**:
   - Go to https://myaccount.microsoft.com/
   - Check if mobile phone is listed there

## Most Likely Issue

Based on the response, the most likely issue is that your mobile phone is stored in Azure AD but not synced to the `mobilePhone` attribute that Graph API returns. This often happens when:

1. The mobile is set as an authentication method but not in the profile
2. The mobile is in on-premises AD but not synced to cloud
3. The mobile is in a different field (like second business phone)

## Recommended Action

1. First, check where your mobile is actually stored in Azure AD
2. Update the Graph API call to fetch from the correct field
3. If needed, update your Azure AD profile to ensure mobile is in the standard field
4. As a last resort, use the temporary workaround in n8n

The n8n node fix I provided earlier is working correctly - it's properly extracting whatever data the frontend sends. The issue is that Microsoft Graph API isn't returning your mobile phone in the expected field.