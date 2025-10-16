const { randomUUID } = require('crypto');
const { runFullSync } = require('../sync-lib');

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
  try {
    const res = await runFullSync(context.log);
    context.res = ok({ status: 'completed', id, ...res }, 200);
  } catch (err) {
    context.log.error('runsync error', err);
    context.res = ok({ status: 'failed', id, error: String(err && err.message || err) }, 500);
  }
};
