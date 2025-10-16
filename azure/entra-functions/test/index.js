module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  context.res = {
    status: 200,
    headers,
    body: {
      ok: true,
      service: "entra-api",
      time: new Date().toISOString(),
      env: {
        node: process.version,
        region: process.env.WEBSITE_SITE_NAME || null
      }
    }
  };
};
