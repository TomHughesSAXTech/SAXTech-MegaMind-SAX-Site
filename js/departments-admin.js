// Department Admin (injects into admin.html Departments tab)
(function(){
    const GH_OWNER = 'TomHughesSAXTech';
    const GH_REPO = 'SAXTech-MegaMind-SAX-Site';
    const GH_BRANCH = 'main';
    const DEPTS_PATH = 'config/departments.json';

    let departments = [];
    let currentSha = null;

    function el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstChild; }

    async function getBlobUrlForDepartments(){
        try{
            const sas = await fetch('/api/generatesastoken?blobPath=' + encodeURIComponent('megamind-config/departments.json'));
            if (!sas.ok) return null;
            const j = await sas.json().catch(()=>({}));
            return j.blobUrl || j.url || j.sasUrl || null;
        }catch(e){ return null; }
    }

    async function loadDepartments(){
        // Prefer blob-based config first
        try{
            const blobUrl = await getBlobUrlForDepartments();
            if (blobUrl) {
                const r = await fetch(blobUrl, { cache: 'no-store' });
                if (r.ok) {
                    const jb = await r.json();
                    departments = Array.isArray(jb) ? jb : (jb.departments || []);
                }
            }
        }catch(e){ /* ignore and fallback */ }
        // Fallback to site file
        if (!Array.isArray(departments) || departments.length === 0) {
            try{
                const res = await fetch('/config/departments.json?cb=' + Date.now(), { cache: 'no-store' });
                if(!res.ok){ throw new Error('Failed to load departments.json'); }
                const j = await res.json();
                departments = Array.isArray(j) ? j : (j.departments || []);
            }catch(e){
                console.warn('Departments load failed:', e);
                departments = [];
            }
        }
        // Get GitHub sha (for optional GitHub save)
        try{
            const gh = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + DEPTS_PATH + '?ref=' + GH_BRANCH);
            if(gh.ok){ const meta = await gh.json(); currentSha = meta.sha; }
        }catch{}
    }

    function renderList(){
        const list = document.getElementById('deptList');
        if(!list) return;
        if(!departments.length){
            list.innerHTML = '<div style="color:#64748b;">No departments configured.</div>';
            return;
        }
        list.innerHTML = '';
        departments.forEach((name, idx) => {
            const row = el('<div class="department-item">' +
                '<div class="department-name" data-idx="' + idx + '">' + escapeHtml(name) + '</div>' +
                '<div class="department-actions">' +
                '<button class="btn btn-edit btn-small" data-action="edit" data-idx="' + idx + '">Edit</button>' +
                '<button class="btn btn-delete btn-small" data-action="delete" data-idx="' + idx + '">Delete</button>' +
                '</div>' +
                '</div>');
            list.appendChild(row);
        });
    }

    function attachHandlers(){
        const addBtn = document.getElementById('addDeptBtn');
        const input = document.getElementById('newDeptInput');
        const list = document.getElementById('deptList');
        const saveBtn = document.getElementById('saveDeptBtn');
        const tokenInput = document.getElementById('ghTokenInput');
        const saveBlobBtn = document.getElementById('saveBlobBtn');

        addBtn?.addEventListener('click', ()=>{
            const v = (input.value||'').trim();
            if(!v) return;
            if(departments.includes(v)){ alert('Department already exists'); return;}
            departments.push(v);
            departments.sort((a,b)=>a.localeCompare(b));
            input.value='';
            renderList();
        });

        list?.addEventListener('click', (e)=>{
            const btn = e.target.closest('button');
            if(!btn) return;
            const idx = parseInt(btn.getAttribute('data-idx'),10);
            const action = btn.getAttribute('data-action');
            if(action==='delete'){
                departments.splice(idx,1);
                renderList();
            } else if(action==='edit'){
                const nameEl = list.querySelector('.department-name[data-idx="' + idx + '"]');
                if(!nameEl) return;
                const current = departments[idx];
                const parent = nameEl.parentElement;
                parent.classList.add('editing');
                nameEl.outerHTML = '<input class="department-input" data-idx="' + idx + '" value="' + escapeHtml(current) + '">';
                btn.textContent = 'Save';
                btn.setAttribute('data-action','save-edit');
            } else if(action==='save-edit'){
                const inp = list.querySelector('.department-input[data-idx="' + idx + '"]');
                if(!inp) return;
                const v = (inp.value||'').trim();
                if(!v) return;
                departments[idx] = v;
                renderList();
            }
        });

        saveBtn?.addEventListener('click', async ()=>{
            const token = (tokenInput?.value||'').trim();
            if(!token){ alert('Enter a GitHub token with repo scope to save.'); return; }
            try{
                const payload = { departments: departments };
                const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
                const body = { message: 'Update departments.json via Admin UI', content, branch: GH_BRANCH };
                if(currentSha) body.sha = currentSha;
                const res = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + DEPTS_PATH, {
                    method:'PUT',
                    headers:{ 'Authorization': 'Bearer ' + token, 'Content-Type':'application/json' },
                    body: JSON.stringify(body)
                });
                if(!res.ok){
                    const t = await res.text();
                    throw new Error('GitHub save failed: ' + res.status + ' - ' + t);
                }
                const j = await res.json();
                currentSha = j.content?.sha || currentSha;
                alert('Departments saved to GitHub.');
            }catch(e){
                console.error(e);
                alert('Failed to save departments: '+ e.message);
            }
        });

        saveBlobBtn?.addEventListener('click', async ()=>{
            try{
                const body = {
                    kind: 'departments',
                    container: 'megamind-config',
                    path: 'departments.json',
                    departments: departments
                };
                const res = await fetch('/api/managevoiceconfig', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if(!res.ok){
                    const t = await res.text();
                    throw new Error('Blob save failed: ' + res.status + ' - ' + t);
                }
                alert('Departments saved to Blob.');
            }catch(e){
                console.error(e);
                alert('Failed to save to Blob: ' + e.message);
            }
        });
    }

    function escapeHtml(s){ 
        return String(s).replace(/[&<>"']/g, function(c){
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]||c;
        }); 
    }

    function buildDepartmentAdminUI(){
        const tab = document.getElementById('department-editor-tab');
        if(!tab) return;
        tab.innerHTML = '' +
          '<div class=\"admin-card full-width\">' +
            '<h2>Department Manager</h2>' +
            '<p style=\"color:#64748b;margin-bottom:10px;\">Add, edit, and remove departments. Save either to Blob (preferred) or to GitHub.</p>' +
            '<div class=\"form-group\" style=\"display:flex;gap:10px;align-items:center;\">' +
              '<button class=\"btn btn-success\" id=\"saveBlobBtn\">Save to Blob</button>' +
              '<span style=\"color:#64748b;font-size:12px;\">Blob: megamind-config/departments.json</span>' +
            '</div>' +
            '<div class=\"form-group\">' +
              '<label>GitHub Token (repo scope)</label>' +
              '<input id=\"ghTokenInput\" type=\"password\" placeholder=\"ghp_...\" class=\"form-input\">' +
              '<div style=\"margin-top:8px;display:flex;gap:10px;align-items:center;\">' +
                '<button class=\"btn btn-primary\" id=\"saveDeptBtn\">Save to GitHub</button>' +
              '</div>' +
            '</div>' +
            '<div style=\"display:flex;gap:10px;align-items:center;margin-bottom:10px;\">' +
              '<input id=\"newDeptInput\" class=\"form-input\" placeholder=\"Add a new department\">' +
              '<button class=\"btn btn-secondary\" id=\"addDeptBtn\">Add</button>' +
            '</div>' +
            '<div id=\"deptList\" class=\"voice-list\"></div>' +
          '</div>';
    }

    async function initDepartmentAdmin(){
        buildDepartmentAdminUI();
        await loadDepartments();
        renderList();
        attachHandlers();
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', initDepartmentAdmin);
    } else {
        initDepartmentAdmin();
    }
})();