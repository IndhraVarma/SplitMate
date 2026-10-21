/**
 * CLI wrapper around the development seed.
 *
 * Run with:  npm run seed        (from the server directory)
 *
 * It connects to whatever MONGODB_URI points at, WIPES every collection, and
 * inserts the fictional demo data set. Never point it at a real database.
 */
import { seedDemoData } from './seedCore.js';
import { disconnectDatabase } from '../config/database.js';

seedDemoData({ connect: true })
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seeding failed:', error.message);
    await disconnectDatabase().catch(() => null);
    process.exit(1);
  });
