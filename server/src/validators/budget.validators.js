import { z } from 'zod';
import { positivePaise } from './common.js';
import { EXPENSE_CATEGORIES } from '../utils/constants.js';

/**
 * Upsert semantics: posting the same (year, month, category) twice updates the
 * limit rather than failing, which is what a "Set budget" form should do.
 */
export const upsertBudgetSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    year: z.coerce.number().int().min(2000).max(2200),
    month: z.coerce.number().int().min(1).max(12),
    limit: positivePaise,
  })
  .strict();

export const budgetQuery = z
  .object({
    year: z.coerce.number().int().min(2000).max(2200).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .strip();
