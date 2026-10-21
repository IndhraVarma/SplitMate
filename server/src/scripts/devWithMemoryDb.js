/**
 * DEVELOPMENT-ONLY convenience runner.
 *
 * Starts a throw-away in-memory MongoDB replica set, points MONGODB_URI at it,
 * seeds fictional data, and then runs the normal API server. Nothing is
 * persisted: stop the process and the database is gone.
 *
 * This exists so the project can be run and explored without first creating a
 * MongoDB Atlas account. It is NEVER used in production - production reads
 * MONGODB_URI from the environment, exactly as server.js expects.
 *
 * Run with:  npm run dev:memory    (from the server directory)
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the in-memory database in production.');
  process.exit(1);
}

console.log('Starting a temporary in-memory MongoDB (first run downloads it)...');
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});

process.env.MONGODB_URI = replSet.getUri('splitmate');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log('In-memory MongoDB ready.');

// Seed first so the UI has something to show, then hand over to the real server.
const { seedDemoData } = await import('./seedCore.js');
await seedDemoData({ connect: true });

await import('../server.js');

const stop = async () => {
  await replSet.stop().catch(() => null);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
