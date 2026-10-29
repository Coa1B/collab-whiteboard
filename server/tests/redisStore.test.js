// Runs the shared store contract against a real Redis server.
// Start it with `npm run db:up`; skipped when REDIS_URL is not set.
const Redis = require('ioredis');
const { RedisBoardStore } = require('../src/store/redisStore');
const { runStoreContract } = require('./storeContract');

// A separate logical database so tests never touch dev data.
const url = process.env.REDIS_URL && `${process.env.REDIS_URL.replace(/\/\d+$/, '')}/15`;
const describeRedis = url ? describe : describe.skip;

describeRedis('RedisBoardStore', () => {
  runStoreContract(async (options) => {
    const admin = new Redis(url);
    await admin.flushdb();
    await admin.quit();
    return new RedisBoardStore(url, options);
  });
});
