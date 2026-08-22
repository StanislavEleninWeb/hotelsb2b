// Flush the test Redis once before the suite so accumulated rate-limit / lockout /
// idempotency counters from a prior run don't cause flaky 429s. Test-only Redis.
const Redis = require('ioredis');

module.exports = async () => {
  const url = process.env.REDIS_URL || 'redis://:redis_dev_password@localhost:6379';
  const redis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
  try {
    await redis.connect();
    await redis.flushdb();
  } catch {
    // Redis not reachable — the app will surface its own error; nothing to flush.
  } finally {
    redis.disconnect();
  }
};
