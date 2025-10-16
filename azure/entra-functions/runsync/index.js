const { randomUUID } = require('crypto');

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

  const id = randomUUID();
  // Placeholder: in future, enqueue a real sync job here
  context.res = ok({ status: 'queued', id, received: req.body || null }, 202);
};
