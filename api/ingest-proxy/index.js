const https = require('https');
const { URL } = require('url');

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
  const full = new URL(path, base);

  const post = () => new Promise((resolve) => {
    const opts = {
      method: 'POST',
      headers: {
        'x-functions-key': key,
        'Content-Length': '0'
      }
    };
    const req2 = https.request(full, opts, (res) => {
      let data='';
      res.on('data', (c)=> data += c);
      res.on('end', ()=> resolve({ status: res.statusCode || 500, body: data }));
    });
    req2.on('error', (e)=> resolve({ status: 500, body: String(e) }));
    req2.end();
  });

  const r = await post();
  return { status: r.status, headers: { 'content-type': 'application/json' }, body: r.body || JSON.stringify({ ok: true }) };
};
