import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import * as service from '../services/expense.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listExpenses(req.params.groupId, req.query);
  return sendSuccess(res, { expenses: items }, { meta });
});

export const getOne = asyncHandler(async (req, res) =>
  sendSuccess(res, { expense: await service.getExpense(req.params.groupId, req.params.id) })
);

export const create = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    { expense: await service.createExpense(req.params.groupId, req.userId, req.body) },
    { message: 'Expense added.' }
  )
);

export const update = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    { expense: await service.updateExpense(req.params.groupId, req.params.id, req.userId, req.body) },
    { message: 'Expense updated.' }
  )
);

export const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, await service.deleteExpense(req.params.groupId, req.params.id), {
    message: 'Expense deleted.',
  })
);
