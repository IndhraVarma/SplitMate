import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Retries a few times with linear backoff so a cold Atlas
 * cluster or a brief network blip does not kill the process on deploy.
 */
export async function connectDatabase(uri = config.mongoUri, { retries = 3 } = {}) {
  if (!uri) throw new Error('MONGODB_URI is not set.');
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      });
      logger.info(`MongoDB connected (${mongoose.connection.name})`);
      return mongoose.connection;
    } catch (error) {
      lastError = error;
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  throw lastError;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

/**
 * Replica sets (MongoDB Atlas) support multi-document transactions; a plain
 * standalone mongod does not. Multi-document writes call this to decide whether
 * to open a session or fall back to the documented compensating-write path.
 */
export function supportsTransactions() {
  const client = mongoose.connection.client;
  if (!client || !client.topology) return false;
  const description = client.topology.description;
  if (!description) return false;
  return description.type === 'ReplicaSetWithPrimary' || description.type === 'Sharded';
}

export { mongoose };
