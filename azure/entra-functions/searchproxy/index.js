const ok = (body, status = 200) => ({
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  },
  body
});

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = ok(null, 204);
    return;
  }

  try {
    const endpoint = process.env.SEARCH_ENDPOINT;
    const apiKey = process.env.SEARCH_API_KEY;
    const apiVersion = process.env.SEARCH_API_VERSION || '2023-11-01';

    if (!endpoint || !apiKey) {
      context.res = ok({ error: 'Search service not configured' }, 503);
      return;
    }

    const body = req.body || {};
    const indexName = body.indexName || body.index || body.index_name;
    if (!indexName) {
      context.res = ok({ error: 'indexName is required' }, 400);
      return;
    }

    const url = `${endpoint.replace(/\/$/, '')}/indexes/${encodeURIComponent(indexName)}/docs/search?api-version=${encodeURIComponent(apiVersion)}`;

    const searchBody = {
      search: body.search ?? "*",
      top: body.top ?? 5,
      count: body.count ?? true,
      select: body.select,
      filter: body.filter,
      orderby: body.orderby
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(searchBody)
    });

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }

    context.res = ok({ status: resp.status, ok: resp.ok, data: json }, resp.ok ? 200 : resp.status);
  } catch (err) {
    context.log.error('searchproxy error', err);
    context.res = ok({ error: 'Proxy error', detail: String(err && err.message || err) }, 500);
  }
};
