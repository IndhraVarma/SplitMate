import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import transactionRoutes from './transaction.routes.js';
import budgetRoutes from './budget.routes.js';
import groupRoutes from './group.routes.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (_req, res) =>
  sendSuccess(res, {
    name: 'SplitMate API',
    version: '1.0.0',
    docs: 'See docs/API.md in the repository.',
    endpoints: ['/api/health', '/api/auth', '/api/transactions', '/api/budgets', '/api/groups'],
  })
);

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/budgets', budgetRoutes);
router.use('/groups', groupRoutes);

export default router;
