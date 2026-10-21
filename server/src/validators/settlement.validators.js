import { z } from 'zod';
import { objectId, positivePaise, dateString } from './common.js';
import { SETTLEMENT_METHODS } from '../utils/constants.js';

export const createSettlementSchema = z
  .object({
    fromUser: objectId,
    toUser: objectId,
    amount: positivePaise,
    method: z.enum(SETTLEMENT_METHODS).optional().default('other'),
    note: z.string().trim().max(200).optional().default(''),
    settledAt: dateString.optional(),
    /**
     * Idempotency key. The client generates one per settlement form, so a
     * double submit is recognised and returns the first settlement untouched.
     */
    clientRequestId: z.string().trim().min(8).max(64).optional(),
  })
  .strict()
  .refine((d) => d.fromUser !== d.toUser, {
    path: ['toUser'],
    message: 'A member cannot settle up with themselves.',
  });

export const listSettlementsQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    userId: objectId.optional(),
  })
  .strip();
