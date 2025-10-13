module.exports = async function (context, req) {
  const src = String((req.query.src || (req.body && req.body.src) || 'cfr')).toLowerCase();
  const base = process.env.INGEST_BASE || 'https://saxtech-tax-ingestor-premium.azurewebsites.net';
  const key = process.env.INGEST_FUNC_KEY;
  if (!key) {
    return { status: 500, body: 'INGEST_FUNC_KEY not set in application settings' };
  }
  let path = '/api/ingest';
  if (src === 'usc') path = '/api/ingest_usc';
  if (src === 'both') path = '/api/ingest_all';
  const url = base + path;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-functions-key': key, 'Content-Length': '0' }
    });
    const text = await r.text();
    return { status: r.status, headers: { 'content-type': 'application/json' }, body: text || JSON.stringify({ ok: true }) };
  } catch (e) {
    context.log('ingest-proxy error', e);
    return { status: 500, body: String(e) };
  }
};
