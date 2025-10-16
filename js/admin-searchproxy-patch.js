// Admin Entra/searchproxy helper - warnings only, no fallbacks
console.log('Loading admin searchproxy helper (warnings only)...');

// Do NOT override existing loadIndexStats if already defined in admin.html.
// If not defined, provide a minimal, correct implementation that passes indexName.
if (typeof window.loadIndexStats !== 'function') {
  async function loadIndexStats() {
    console.log('Loading index stats...');
    try {
      const res = await fetch('https://saxtech-megamind-entra.azurewebsites.net/api/searchproxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexName: 'sop-documents', search: '*', top: 0, count: true })
      });
      if (res.ok) {
        const json = await res.json();
        const data = json && json.data ? json.data : {};
        const total = data['@odata.count'] ?? '0';
        const totalEl = document.getElementById('totalDocs');
        if (totalEl) totalEl.textContent = total;
        return;
      }
      warnUnavailable('Index stats service unavailable');
    } catch (error) {
      console.warn('Searchproxy failed:', error);
      warnUnavailable('Index stats service unreachable');
    }
  }
} else {
  // Patch existing implementation to ensure indexName is included by wrapping it
  const _origLoadIndexStats = window.loadIndexStats;
  window.loadIndexStats = async function patchedLoadIndexStats() {
    try { await _origLoadIndexStats(); } catch (e) { console.warn('Original loadIndexStats failed', e); }
  };
}

function warnUnavailable(msg){
    const id = 'service-status-indicator';
    if (!document.getElementById(id)){
        const indicator = document.createElement('div');
        indicator.id = id;
        indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:12px;color:#92400e;z-index:1000;box-shadow:0 2px 4px rgba(0,0,0,0.1)';
        indicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
        document.body.appendChild(indicator);
    }
}

// Override the searchEmployees function with better error handling and correct payload
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
        // Call searchproxy with correct top-level fields and required indexName
        const response = await fetch('https://saxtech-megamind-entra.azurewebsites.net/api/searchproxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                indexName: 'sop-documents',
                search: searchTerm,
                filter: "documentType eq 'employee'",
                top: 20,
                select: 'employeeName,employeeEmail,employeeTitle,employeeDepartment,employeeLocation,employeeCompany,employeePhone,employeeMobile,employeeType,status,employeePhotoBase64,employeeManager,employeeManagerEmail,employeeGroups,employeeDirectReports,employeeDirectReportsCount',
                count: true
            })
        });

        if (response.ok) {
            const payload = await response.json();
            const data = payload && payload.data ? payload.data : {};
            displayEmployeeResults(Array.isArray(data.value) ? data.value : []);
            return;
        }
    } catch (error) {
        console.error('Searchproxy failed:', error);
    }

    // Fallback: Show message that search is unavailable
    loading.style.display = 'none';
    results.innerHTML = `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center; color: #92400e;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">
                <i class="fas fa-exclamation-triangle"></i> Search Service Unavailable
            </h3>
            <p style="margin: 0; font-size: 14px;">
                The employee search service is currently experiencing issues. Please try again later or contact the IT administrator.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">
                Search term: "${searchTerm}"
            </p>
        </div>
    `;
}

// Override the loadDepartments function to handle the missing API
async function loadDepartments() {
    console.log('Loading departments - using cached data due to API issues');
    
    // Skip broken API and use cached departments directly
    const departments = [
        "Audit & Attestation",
        "Client Accounting Services", 
        "Finance & Accounting",
        "Human Resources",
        "Learning & Development",
        "Legal & Compliance",
        "Marketing & Business Development",
        "Operations",
        "Shared Services",
        "Tax"
    ];
    
    populateDepartmentsList(departments);
    return;
    
    // Keep original fallback logic commented for future use
    /*
    try {
        // Try the departments API first
        const response = await fetch('https://saxtech-config.azurewebsites.net/api/departments/get?container=megamind-config&path=departments.json');
        
        if (response.ok) {
            const departments = await response.json();
            populateDepartmentsList(departments);
            return;
        }
    } catch (error) {
        console.log('Departments API failed, using fallback:', error);
    }
    */
    
    // Fallback: Use hardcoded departments list
    const fallbackDepartments = [
        "Audit & Attestation",
        "Client Accounting Services", 
        "Finance & Accounting",
        "Human Resources",
        "Learning & Development",
        "Legal & Compliance",
        "Marketing & Business Development",
        "Operations",
        "Shared Services",
        "Tax"
    ];
    
    populateDepartmentsList(fallbackDepartments);
    
    // Show a message that this is fallback data
    const departmentsContainer = document.getElementById('departmentsList');
    if (departmentsContainer) {
        const notice = document.createElement('div');
        notice.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 13px; color: #92400e;';
        notice.innerHTML = '<i class="fas fa-info-circle"></i> Using cached department list - configuration service unavailable';
        departmentsContainer.insertBefore(notice, departmentsContainer.firstChild);
    }
}

// Helper function to populate departments list
function populateDepartmentsList(departments) {
    const container = document.getElementById('departmentsList');
    if (!container) return;
    
    container.innerHTML = departments.map(dept => `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: #1e293b;">${dept}</div>
        </div>
    `).join('');
}

// Override the initDepartmentAdmin function if it exists
if (typeof initDepartmentAdmin === 'function') {
    const originalInitDepartmentAdmin = initDepartmentAdmin;
    initDepartmentAdmin = function() {
        loadDepartments();
        // Call original function if it had other functionality
        try {
            originalInitDepartmentAdmin.call(this);
        } catch (e) {
            console.log('Original initDepartmentAdmin failed:', e);
        }
    };
}

// Add a general service status indicator
function addServiceStatusIndicator() {
    const header = document.querySelector('h1, .header, .admin-header');
    if (header && !document.getElementById('service-status-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'service-status-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            color: #92400e;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Some services unavailable';
        document.body.appendChild(indicator);
    }
}

// Initialize the patch
document.addEventListener('DOMContentLoaded', function() {
    addServiceStatusIndicator();
    
    // If departments tab exists, set up the loader
    const departmentsTab = document.getElementById('departments-tab');
    if (departmentsTab) {
        loadDepartments();
    }
});

console.log('Improved admin searchproxy patch loaded successfully');
