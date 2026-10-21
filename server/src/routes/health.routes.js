import { Router } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../utils/apiResponse.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * Liveness + readiness in one endpoint. Render pings this to decide whether the
 * instance is healthy, so it must never require a database round-trip to answer,
 * but it does report the connection state so a broken database is visible.
 */
router.get('/', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  return sendSuccess(res, {
    status: 'ok',
    service: 'splitmate-api',
    environment: config.env,
    database: dbState,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
