/**
 * Single source of truth for configuration. Nothing else in the server reads
 * process.env directly, so a missing variable fails loudly here at boot rather
 * than mysteriously at request time.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isTest = NODE_ENV === 'test';
const isProduction = NODE_ENV === 'production';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`
    );
  }
  return value;
}

function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  env: NODE_ENV,
  isTest,
  isProduction,
  isDevelopment: NODE_ENV === 'development',
  port: Number(process.env.PORT || 5000),
  // Tests spin up an in-memory MongoDB and inject the URI, so it is not required there.
  mongoUri: isTest ? process.env.MONGODB_URI || '' : required('MONGODB_URI'),
  jwt: {
    // A weak default would be a production footgun, so only tests get one.
    secret: isTest
      ? process.env.JWT_SECRET || 'test-secret-not-used-in-production'
      : required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || (isTest ? 4 : 10)),
  corsOrigins: parseOrigins(
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
  ),
  seedPassword: process.env.SEED_PASSWORD || 'Password123!',
};

if (config.isProduction && config.jwt.secret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

export default config;
