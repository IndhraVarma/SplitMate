import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as service from '../services/settlement.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listSettlements(req.params.groupId, req.query);
  return sendSuccess(res, { settlements: items }, { meta });
});

export const create = asyncHandler(async (req, res) => {
  const { settlement, duplicate } = await service.createSettlement(
    req.params.groupId,
    req.userId,
    req.body
  );
  // A repeat of an already-recorded settlement is a success, not an error, but
  // it returns 200 rather than 201 so the client can tell nothing new was made.
  return duplicate
    ? sendSuccess(res, { settlement, duplicate: true }, { message: 'This settlement was already recorded.' })
    : sendCreated(res, { settlement, duplicate: false }, { message: 'Settlement recorded.' });
});

export const remove = asyncHandler(async (req, res) => {
  const existing = await service.getSettlement(req.params.groupId, req.params.id);
  const isAdmin = ['owner', 'admin'].includes(req.membership.role);
  if (!isAdmin && String(existing.recordedBy) !== req.userId) {
    throw ApiError.forbidden('Only the person who recorded this settlement, or a group admin, can delete it.');
  }
  return sendSuccess(res, await service.deleteSettlement(req.params.groupId, req.params.id), {
    message: 'Settlement deleted.',
  });
});
