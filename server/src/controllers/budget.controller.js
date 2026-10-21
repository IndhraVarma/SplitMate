import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import * as service from '../services/budget.service.js';

export const upsert = asyncHandler(async (req, res) =>
  sendCreated(res, { budget: await service.upsertBudget(req.userId, req.body) }, {
    message: 'Budget saved.',
  })
);

export const summary = asyncHandler(async (req, res) =>
  sendSuccess(res, await service.getBudgetSummary(req.userId, req.query))
);

export const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, await service.deleteBudget(req.userId, req.params.id), {
    message: 'Budget removed.',
  })
);
