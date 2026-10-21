import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import * as service from '../services/transaction.service.js';
import * as analytics from '../services/analytics.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listTransactions(req.userId, req.query);
  return sendSuccess(res, { transactions: items }, { meta });
});

export const getOne = asyncHandler(async (req, res) =>
  sendSuccess(res, { transaction: await service.getTransaction(req.userId, req.params.id) })
);

export const create = asyncHandler(async (req, res) =>
  sendCreated(res, { transaction: await service.createTransaction(req.userId, req.body) }, {
    message: 'Transaction added.',
  })
);

export const update = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    { transaction: await service.updateTransaction(req.userId, req.params.id, req.body) },
    { message: 'Transaction updated.' }
  )
);

export const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, await service.deleteTransaction(req.userId, req.params.id), {
    message: 'Transaction deleted.',
  })
);

export const summary = asyncHandler(async (req, res) =>
  sendSuccess(res, await analytics.getSummary(req.userId, req.query))
);

export const categoryBreakdown = asyncHandler(async (req, res) =>
  sendSuccess(res, await analytics.getCategoryBreakdown(req.userId, req.query))
);

export const monthlyTrend = asyncHandler(async (req, res) =>
  sendSuccess(res, await analytics.getMonthlyTrend(req.userId, req.query))
);

export const dailyTrend = asyncHandler(async (req, res) =>
  sendSuccess(res, await analytics.getDailyTrend(req.userId, req.query))
);

export const paymentMethods = asyncHandler(async (req, res) =>
  sendSuccess(res, { methods: await analytics.getPaymentMethodBreakdown(req.userId, req.query) })
);
