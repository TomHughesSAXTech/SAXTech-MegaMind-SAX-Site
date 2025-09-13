// COMPLETE FIX: Fetch mobile phone from ALL possible Graph API sources
// This replaces the getUserProfile function in your frontend

async function getUserProfile(accessToken) {
    try {
        // Primary profile fetch with all phone-related fields
        const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,companyName,businessPhones,mobilePhone,city,state,country,manager', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const profile = await profileResponse.json();
        console.log('Primary profile response:', profile);
        
        // If no mobile phone in profile, try beta endpoint with more fields
        if (!profile.mobilePhone) {
            console.log('No mobile in v1.0, trying beta endpoint...');
            
            const betaResponse = await fetch('https://graph.microsoft.com/beta/me?$select=mobilePhone,businessPhones,authentication', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (betaResponse.ok) {
                const betaProfile = await betaResponse.json();
                console.log('Beta profile response:', betaProfile);
                profile.mobilePhone = betaProfile.mobilePhone || profile.mobilePhone;
            }
        }
        
        // Try to get authentication methods (requires UserAuthenticationMethod.Read permission)
        try {
            const authMethodsResponse = await fetch(`https://graph.microsoft.com/v1.0/me/authentication/phoneMethods`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (authMethodsResponse.ok) {
                const authMethods = await authMethodsResponse.json();
                console.log('Authentication methods:', authMethods);
                
                // Look for mobile phone in auth methods
                if (authMethods.value && authMethods.value.length > 0) {
                    const mobileMethod = authMethods.value.find(m => m.phoneType === 'mobile');
                    if (mobileMethod && mobileMethod.phoneNumber) {
                        console.log('Found mobile in auth methods:', mobileMethod.phoneNumber);
                        profile.mobilePhone = mobileMethod.phoneNumber;
                    }
                }
            } else if (authMethodsResponse.status === 403) {
                console.log('No permission to read authentication methods. Add UserAuthenticationMethod.Read.All permission to your app.');
            }
        } catch (authError) {
            console.log('Could not fetch authentication methods:', authError);
        }
        
        // Try Exchange/Office 365 properties
        if (!profile.mobilePhone) {
            try {
                const exchangeResponse = await fetch('https://graph.microsoft.com/v1.0/me/people', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                
                if (exchangeResponse.ok) {
                    const people = await exchangeResponse.json();
                    // Check if self record has mobile
                    const selfRecord = people.value?.find(p => p.userPrincipalName === profile.userPrincipalName);
                    if (selfRecord?.phones) {
                        const mobilePhone = selfRecord.phones.find(p => p.type === 'mobile');
                        if (mobilePhone?.number) {
                            console.log('Found mobile in People API:', mobilePhone.number);
                            profile.mobilePhone = mobilePhone.number;
                        }
                    }
                }
            } catch (peopleError) {
                console.log('Could not fetch from People API:', peopleError);
            }
        }
        
        // Get manager details if exists
        if (profile.manager) {
            try {
                const managerResponse = await fetch('https://graph.microsoft.com/v1.0/me/manager', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                
                if (managerResponse.ok) {
                    const managerData = await managerResponse.json();
                    profile.manager = {
                        name: managerData.displayName,
                        email: managerData.mail,
                        jobTitle: managerData.jobTitle
                    };
                }
            } catch (error) {
                console.log('Manager fetch error:', error);
            }
        }
        
        // Add claims from ID token
        const account = msalInstance.getAllAccounts()[0];
        if (account) {
            profile.claims = {
                oid: account.localAccountId,
                tid: account.tenantId,
                groups: account.idTokenClaims?.groups || [],
                roles: account.idTokenClaims?.roles || [],
                wids: account.idTokenClaims?.wids || []
            };
            
            profile.objectId = account.localAccountId;
            profile.tenantId = account.tenantId;
            profile.groups = account.idTokenClaims?.groups || [];
            profile.roles = account.idTokenClaims?.roles || [];
        }
        
        // Log final profile
        console.log('Final user profile with all sources checked:', profile);
        console.log('Mobile phone status:', profile.mobilePhone ? `Found: ${profile.mobilePhone}` : 'NOT FOUND in any source');
        
        return profile;
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

// ALSO: Update your app permissions
// You need to add these permissions to your Azure AD app registration:
// 1. User.Read (you have this)
// 2. UserAuthenticationMethod.Read.All (to read auth methods)
// 3. People.Read (to read from People API)
// 4. User.ReadBasic.All (you have this)

// To add permissions:
// 1. Go to Azure Portal > App registrations > MegaMind SAX Portal
// 2. Click "API permissions"
// 3. Click "Add a permission"
// 4. Choose "Microsoft Graph"
// 5. Choose "Delegated permissions"
// 6. Search for and add:
//    - UserAuthenticationMethod.Read or UserAuthenticationMethod.Read.All
//    - People.Read
// 7. Click "Grant admin consent" (requires admin)

console.log('Mobile phone fetch fix loaded. This will try multiple Graph API endpoints to find mobile phones.');