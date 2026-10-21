import { Router } from 'express';
import * as controller from '../controllers/transaction.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuery,
  summaryQuery,
  transactionIdParam,
} from '../validators/transaction.validators.js';

const router = Router();

// Everything below belongs to the signed-in user and is scoped by their id.
router.use(authenticate);

router.get('/summary', validate({ query: summaryQuery }), controller.summary);
router.get('/analytics/categories', validate({ query: summaryQuery }), controller.categoryBreakdown);
router.get('/analytics/monthly', validate({ query: summaryQuery }), controller.monthlyTrend);
router.get('/analytics/daily', validate({ query: summaryQuery }), controller.dailyTrend);
router.get('/analytics/payment-methods', validate({ query: summaryQuery }), controller.paymentMethods);

router.get('/', validate({ query: listTransactionsQuery }), controller.list);
router.post('/', validate({ body: createTransactionSchema }), controller.create);
router.get('/:id', validate({ params: transactionIdParam }), controller.getOne);
router.patch(
  '/:id',
  validate({ params: transactionIdParam, body: updateTransactionSchema }),
  controller.update
);
router.delete('/:id', validate({ params: transactionIdParam }), controller.remove);

export default router;
