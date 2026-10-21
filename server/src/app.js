import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

/**
 * Builds the Express application. Kept separate from server.js so tests can
 * mount the app with supertest without opening a port or connecting to Atlas.
 */
export function createApp() {
  const app = express();

  // Render terminates TLS at its proxy; without this, req.ip (used by the rate
  // limiter) would be the proxy's address for every caller.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only, never HTML, so a restrictive CSP here adds
      // nothing; the SPA's own host sets its policy.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  /**
   * CORS: only the origins listed in CORS_ORIGINS may call the API from a
   * browser. Requests with no Origin header (curl, server-to-server, health
   * checks) are allowed, since CORS is a browser protection and such callers
   * are not subject to it.
   */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalised = origin.replace(/\/$/, '');
        if (config.corsOrigins.includes(normalised)) return callback(null, true);
        // Any Vercel preview deployment of this project is allowed in non-production.
        if (!config.isProduction && /^https?:\/\/localhost(:\d+)?$/.test(normalised)) {
          return callback(null, true);
        }
        return callback(new Error('NOT_ALLOWED_BY_CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api', apiLimiter, routes);

  // A bare GET / is useful when someone opens the Render URL in a browser.
  app.get('/', (_req, res) => {
    res.json({ success: true, data: { name: 'SplitMate API', health: '/api/health' } });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
