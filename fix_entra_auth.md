# Fix for Entra ID OAuth2 Token Expiration in n8n

## Problem
The Microsoft Entra ID (Azure AD) OAuth2 credentials expire after 1 hour and aren't automatically refreshing.

## Solution Steps

### 1. Update the OAuth2 Credential Configuration

In n8n, go to your Microsoft Entra OAuth2 credential and ensure these settings:

1. **Open the credential** "Microsoft Entra ID (Azure Active Directory) account"

2. **Check these critical settings:**
   - **Grant Type**: Should be `Authorization Code`
   - **Auth URI Grant Type**: Should be `Authorization Code with PKCE` (if available)
   - **Access Token URL**: Should include `offline_access` scope

3. **Update the Scope** (MOST IMPORTANT):
   Add `offline_access` to your scopes. Your scope should look like:
   ```
   offline_access User.Read User.ReadBasic.All
   ```
   or whatever scopes you need, but `offline_access` MUST be first.

4. **Advanced Settings** (click on "Add Option" if not visible):
   - **Authentication**: Set to `Body`
   - **Ignore SSL Issues**: Leave as `false`
   - **Include Credentials in Body**: Set to `true`

### 2. Re-authorize with the Updated Settings

After updating:
1. Click **"Reconnect OAuth2 Credential"**
2. Sign in again when prompted
3. **IMPORTANT**: Make sure you consent to "Maintain access to data you have given it access to"

### 3. Alternative: Use Client Credentials Flow (for Service-to-Service)

If this is for backend service operations (not user-specific), consider using Client Credentials:

1. Create a new credential
2. Set **Grant Type** to `Client Credentials`
3. Use these URLs:
   - **Access Token URL**: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`
   - **Scope**: `https://graph.microsoft.com/.default`
4. No user interaction needed, tokens auto-refresh

### 4. Verify in Azure Portal

In Azure Portal, check your app registration:
1. Go to **Azure Active Directory** > **App registrations**
2. Find your app
3. Go to **API permissions**
4. Ensure you have:
   - `offline_access` (Delegated)
   - `User.Read` (Delegated)
   - Any other permissions your tool needs

### 5. Add Environment Variables (Optional)

For better token management, add these to your n8n environment:

```bash
# In your n8n docker-compose.yml or .env file:
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
N8N_PERSONALIZATION_ENABLED=false
```

### 6. Test the Fix

1. After reconnecting with `offline_access` scope
2. Wait 70 minutes (past the 1-hour mark)
3. Test the Entra Users tool
4. It should work without manual reconnection

## Why This Happens

- Azure AD access tokens expire after 1 hour by default
- Without `offline_access` scope, n8n can't get refresh tokens
- Refresh tokens allow automatic renewal without user interaction
- The refresh token is valid for 90 days (default) and auto-renews with use

## Additional Troubleshooting

If still having issues:

1. **Check Token Lifetime Policies** in Azure:
   ```powershell
   # In Azure Cloud Shell or PowerShell with Azure module
   Get-AzureADPolicy | Where-Object {$_.Type -eq "TokenLifetimePolicy"}
   ```

2. **Enable Refresh Token Rotation** in Azure Portal:
   - Go to your App Registration
   - Authentication > Advanced Settings
   - Enable "Allow public client flows"

3. **Check n8n Logs**:
   ```bash
   # If using Docker
   docker logs n8n
   
   # If using PM2
   pm2 logs n8n
   ```

4. **Force Token Refresh in n8n**:
   - Some versions of n8n have issues with token refresh
   - Consider updating n8n to the latest version
   - Or create a scheduled workflow that tests the credential every 45 minutes to keep it fresh

## Quick Fix Script (if needed)

If you need a workaround while fixing the root cause, create a workflow that:
1. Runs every 45 minutes
2. Makes a simple Graph API call (like getting current user)
3. This keeps the token fresh

This ensures your main workflows always have a valid token.