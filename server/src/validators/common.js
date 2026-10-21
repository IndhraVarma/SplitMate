import { z } from 'zod';
import mongoose from 'mongoose';
import { toPaise } from '../../../shared/money.js';

/** A 24-character hex MongoDB ObjectId, as a string. */
export const objectId = z
  .string()
  .trim()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), { message: 'Not a valid id.' });

/**
 * Accepts a rupee amount the way a human types it ("1,250.50", 1250.5, "1250")
 * and converts it to integer paise. Everything downstream only ever sees paise.
 */
export const rupeesToPaise = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    try {
      return toPaise(value);
    } catch (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
      return z.NEVER;
    }
  });

export const positivePaise = rupeesToPaise.refine((paise) => paise > 0, {
  message: 'Amount must be greater than zero.',
});

/** YYYY-MM-DD, or any ISO date string. Normalised to a UTC Date. */
export const dateString = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const parsed = match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Not a valid date.' });
      return z.NEVER;
    }
    return parsed;
  });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const idParam = z.object({ id: objectId });
export const groupIdParam = z.object({ groupId: objectId });
export const groupAndIdParams = z.object({ groupId: objectId, id: objectId });

export const trimmedString = (max) => z.string().trim().max(max);
