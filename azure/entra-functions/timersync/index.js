const { runFullSync } = require('../sync-lib');

module.exports = async function (context, myTimer) {
  const timeStamp = new Date().toISOString();
  context.log(`TimerSync triggered at ${timeStamp}`);
  try {
    const res = await runFullSync(context.log);
    context.log('TimerSync completed', res);
  } catch (err) {
    context.log.error('TimerSync failed', err);
  }
};