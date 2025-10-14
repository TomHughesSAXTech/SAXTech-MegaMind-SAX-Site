// Patch the loadIndexStats function to call Azure Search API directly
async function loadIndexStats() {
    try {
        // Get employee count directly from Azure Search
        const employeeResponse = await fetch('https://saxmegamind-search.search.windows.net/indexes/sop-documents/docs/search?api-version=2023-11-01', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO'
            },
            body: JSON.stringify({
                search: "*",
                filter: "employeeType eq 'employee'",
                top: 0,
                count: true
            })
        });
        
        // Get group count directly from Azure Search
        const groupResponse = await fetch('https://saxmegamind-search.search.windows.net/indexes/sop-documents/docs/search?api-version=2023-11-01', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO'
            },
            body: JSON.stringify({
                search: "*",
                filter: "employeeType eq 'group'",
                top: 0,
                count: true
            })
        });
        
        // Get total count directly from Azure Search
        const totalResponse = await fetch('https://saxmegamind-search.search.windows.net/indexes/sop-documents/docs/search?api-version=2023-11-01', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO'
            },
            body: JSON.stringify({
                search: "*",
                top: 0,
                count: true
            })
        });

        if (employeeResponse.ok && groupResponse.ok && totalResponse.ok) {
            const employeeData = await employeeResponse.json();
            const groupData = await groupResponse.json();
            const totalData = await totalResponse.json();

            // Update the display
            document.getElementById('totalEmployees').textContent = employeeData['@odata.count'] || 0;
            document.getElementById('totalGroups').textContent = groupData['@odata.count'] || 0;
            document.getElementById('totalDocs').textContent = totalData['@odata.count'] || 0;
            
            // Calculate photos count (for now, just show a placeholder)
            document.getElementById('photosCount').textContent = '~' + Math.round((employeeData['@odata.count'] || 0) * 0.3);
        } else {
            // Handle error case
            document.getElementById('totalEmployees').textContent = 'Error';
            document.getElementById('totalGroups').textContent = 'Error';
            document.getElementById('totalDocs').textContent = 'Error';
            document.getElementById('photosCount').textContent = 'Error';
            console.error('Failed to load index stats directly from Azure Search');
        }
    } catch (error) {
        console.error('Error loading index stats:', error);
        document.getElementById('totalEmployees').textContent = 'Error';
        document.getElementById('totalGroups').textContent = 'Error';
        document.getElementById('totalDocs').textContent = 'Error';
        document.getElementById('photosCount').textContent = 'Error';
    }
}

// Patch the searchEmployees function to call Azure Search API directly
async function searchEmployees() {
    const searchTerm = document.getElementById('employeeSearchInput').value.trim();
    if (!searchTerm) {
        alert('Please enter a search term');
        return;
    }

    const loading = document.getElementById('employeeSearchLoading');
    const results = document.getElementById('employeeCards');
    const noResults = document.getElementById('noEmployeeResults');
    const searchResults = document.getElementById('employeeSearchResults');

    // Show loading state
    searchResults.style.display = 'block';
    loading.style.display = 'block';
    results.innerHTML = '';
    noResults.style.display = 'none';

    try {
        // Search for employees directly
        const response = await fetch('https://saxmegamind-search.search.windows.net/indexes/sop-documents/docs/search?api-version=2023-11-01', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': 'sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO'
            },
            body: JSON.stringify({
                search: searchTerm,
                top: 50,
                select: "id,employeeName,employeeEmail,employeeDepartment,employeeCompany,employeeTitle,employeeManager,employeePhone,employeeLocation"
            })
        });

        if (response.ok) {
            const data = await response.json();
            displayEmployeeResults(data.value || []);
        } else {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error searching employees:', error);
        alert('Error searching employees: ' + error.message);
    } finally {
        loading.style.display = 'none';
    }
}

// Function to display employee search results
function displayEmployeeResults(employees) {
    const results = document.getElementById('employeeCards');
    const noResults = document.getElementById('noEmployeeResults');

    if (employees.length === 0) {
        noResults.style.display = 'block';
        return;
    }

    results.innerHTML = employees.map(emp => `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; transition: all 0.2s ease;">
            <div style="display: flex; align-items: start; gap: 15px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px; flex-shrink: 0;">
                    ${(emp.employeeName || 'U').charAt(0)}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">
                        ${emp.employeeName || 'Unknown Name'}
                    </h3>
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                        <strong>Email:</strong> ${emp.employeeEmail || 'N/A'}
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                        <strong>Title:</strong> ${emp.employeeTitle || 'N/A'}
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                        <strong>Department:</strong> ${emp.employeeDepartment || 'N/A'}
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                        <strong>Company:</strong> ${emp.employeeCompany || 'N/A'}
                    </div>
                    ${emp.employeeLocation ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 4px;"><strong>Location:</strong> ${emp.employeeLocation}</div>` : ''}
                    ${emp.employeePhone ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 4px;"><strong>Phone:</strong> ${emp.employeePhone}</div>` : ''}
                    ${emp.employeeManager ? `<div style="font-size: 13px; color: #64748b;"><strong>Manager:</strong> ${emp.employeeManager}</div>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

console.log('Admin page searchproxy bypass patch loaded successfully');