import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Every test runs against a real MongoDB - an in-memory replica set, so the
 * transaction paths in the services are exercised rather than skipped. No test
 * ever touches a developer's real database.
 */
process.env.NODE_ENV = 'test';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 20000 });
}, 120000);

afterEach(async () => {
  // Wipe between tests so each one starts from a known, empty database.
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
