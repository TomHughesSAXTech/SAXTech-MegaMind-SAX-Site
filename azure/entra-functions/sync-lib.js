const fetch = global.fetch || require('node-fetch');

const SEARCH_ENDPOINT = (process.env.SEARCH_ENDPOINT || '').replace(/\/$/, '');
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;
const SEARCH_API_VERSION = process.env.SEARCH_API_VERSION || '2023-11-01';
const SEARCH_INDEX = process.env.SEARCH_INDEX || 'sop-documents';

const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
const TENANTS = (process.env.TENANTS || '').split(/[,\s]+/).filter(Boolean);

function assertEnv() {
  if (!SEARCH_ENDPOINT || !SEARCH_API_KEY) throw new Error('Search service not configured');
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) throw new Error('Graph credentials not configured');
  if (TENANTS.length === 0) throw new Error('TENANTS not configured');
}

async function ensureIndexConfigured(log = console) {
  // Make employeeType/documentType filterable/facetable if present
  const idxUrl = `${SEARCH_ENDPOINT}/indexes/${encodeURIComponent(SEARCH_INDEX)}?api-version=${encodeURIComponent(SEARCH_API_VERSION)}`;
  const get = await fetch(idxUrl, { headers: { 'api-key': SEARCH_API_KEY } });
  if (!get.ok) {
    const txt = await get.text();
    throw new Error(`Failed to fetch index: ${get.status}: ${txt}`);
  }
  const indexDef = await get.json();
  let changed = false;
  for (const f of indexDef.fields || []) {
    if (f.name === 'employeeType' || f.name === 'documentType') {
      if (!f.filterable || !f.facetable) {
        f.filterable = true; f.facetable = true; changed = true;
      }
    }
  }
  if (changed) {
    const put = await fetch(idxUrl, {
      method: 'PUT',
      headers: { 'api-key': SEARCH_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(indexDef)
    });
    if (!put.ok && put.status !== 204) {
      const txt = await put.text();
      throw new Error(`Failed to update index: ${put.status}: ${txt}`);
    }
    log('Index updated: employeeType/documentType made filterable/facetable');
  }
}

async function getGraphToken(tenant) {
  const params = new URLSearchParams();
  params.set('client_id', GRAPH_CLIENT_ID);
  params.set('client_secret', GRAPH_CLIENT_SECRET);
  params.set('grant_type', 'client_credentials');
  params.set('scope', 'https://graph.microsoft.com/.default');
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Graph token error (${tenant}): ${resp.status} ${JSON.stringify(json)}`);
  return json.access_token;
}

async function fetchAll(url, token, selector = d => d.value || []) {
  let next = url, out = [];
  while (next) {
    const resp = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!resp.ok) throw new Error(`Graph fetch error: ${resp.status} ${JSON.stringify(json)}`);
    out = out.concat(selector(json));
    next = json['@odata.nextLink'] || null;
  }
  return out;
}

function normalizeUser(u, tenantDisplay) {
  return {
    '@search.action': 'mergeOrUpload',
    id: `employee_${(tenantDisplay || 'tenant').replace(/[^a-zA-Z0-9]/g,'_')}_${u.id}`,
    chunkId: `employee_${u.id}`,
    content: `${u.displayName || ''} ${u.jobTitle || ''} ${u.department || ''} ${u.mail || ''} ${tenantDisplay || ''}`,
    documentId: `employee_${u.id}`,
    fileName: `${u.displayName || u.mail || 'Employee'}_Profile`,
    title: `${u.displayName || 'Employee'} - ${tenantDisplay || ''}`,
    uploadDate: new Date().toISOString(),
    chunkIndex: 0,
    employeeName: u.displayName || '',
    employeeTitle: u.jobTitle || '',
    employeeDepartment: u.department || '',
    employeeManager: '',
    employeeLocation: u.officeLocation || '',
    employeeCompany: tenantDisplay || '',
    employeePhone: Array.isArray(u.businessPhones) ? (u.businessPhones[0] || '') : '',
    employeeMobile: u.mobilePhone || '',
    employeeEmail: u.mail || u.userPrincipalName || '',
    employeeType: 'employee',
    employeePhotoBase64: '',
    documentType: 'employee'
  };
}

function normalizeGroup(g, tenantDisplay) {
  return {
    '@search.action': 'mergeOrUpload',
    id: `group_${(tenantDisplay || 'tenant').replace(/[^a-zA-Z0-9]/g,'_')}_${g.id}`,
    chunkId: `group_${g.id}`,
    content: `${g.displayName || ''} ${tenantDisplay || ''}`,
    documentId: `group_${g.id}`,
    fileName: `${g.displayName || 'Group'}_Profile`,
    title: `${g.displayName || 'Group'} - ${tenantDisplay || ''}`,
    uploadDate: new Date().toISOString(),
    chunkIndex: 0,
    employeeName: g.displayName || 'Group',
    employeeCompany: tenantDisplay || '',
    employeeType: 'group',
    documentType: 'group'
  };
}

async function upsertDocuments(docs) {
  if (!docs.length) return { upserted: 0 };
  const url = `${SEARCH_ENDPOINT}/indexes/${encodeURIComponent(SEARCH_INDEX)}/docs/index?api-version=${encodeURIComponent(SEARCH_API_VERSION)}`;
  let upserted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = docs.slice(i, i + 500);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': SEARCH_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: batch })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`Index upsert error: ${resp.status} ${JSON.stringify(json)}`);
    upserted += batch.length;
  }
  return { upserted };
}

async function runFullSync(log = console) {
  assertEnv();
  await ensureIndexConfigured(log);

  let totalUsers = 0, totalGroups = 0, errors = [];
  for (const tenant of TENANTS) {
    try {
      const token = await getGraphToken(tenant);
      const base = 'https://graph.microsoft.com/v1.0';
      const users = await fetchAll(`${base}/users?$select=id,displayName,givenName,surname,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones,officeLocation&$filter=userType eq 'Member'`, token);
      const groups = await fetchAll(`${base}/groups?$select=id,displayName,mail,mailEnabled,securityEnabled,groupTypes`, token);

      const tDisplay = tenant;
      const userDocs = users.map(u => normalizeUser(u, tDisplay));
      const groupDocs = groups.map(g => normalizeGroup(g, tDisplay));

      const up1 = await upsertDocuments(userDocs);
      const up2 = await upsertDocuments(groupDocs);

      totalUsers += userDocs.length;
      totalGroups += groupDocs.length;
      log(`Synced tenant ${tenant}: users=${userDocs.length}, groups=${groupDocs.length}, upserts=${up1.upserted + up2.upserted}`);
    } catch (e) {
      log.error(`Tenant ${tenant} sync error`, e);
      errors.push(`Tenant ${tenant}: ${String(e && e.message || e)}`);
    }
  }

  return {
    total_users: totalUsers,
    total_groups: totalGroups,
    documents_uploaded: totalUsers + totalGroups,
    tenants_processed: TENANTS.map(t => ({ name: t })),
    errors
  };
}

module.exports = { runFullSync };