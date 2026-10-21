import { z } from 'zod';
import { objectId, positivePaise, rupeesToPaise, dateString } from './common.js';
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from '../utils/constants.js';

/**
 * A participant line.
 *  - EQUAL   needs only userId
 *  - EXACT   needs userId + amount (rupees, converted to paise here)
 *  - PERCENT needs userId + percent (converted to integer basis points here)
 */
const participantSchema = z
  .object({
    userId: objectId,
    amount: rupeesToPaise.optional(),
    percent: z.coerce
      .number()
      .min(0, 'A percentage cannot be negative.')
      .max(100, 'A percentage cannot exceed 100.')
      .optional(),
  })
  .strict();

const baseExpense = {
  description: z.string().trim().min(1, 'Describe what this was for.').max(200),
  amount: positivePaise,
  category: z.enum(EXPENSE_CATEGORIES).optional().default('other'),
  date: dateString,
  paidBy: objectId,
  splitType: z.enum(SPLIT_TYPES),
  participants: z.array(participantSchema).min(1, 'Pick at least one person to split with.').max(50),
  notes: z.string().trim().max(500).optional().default(''),
};

/** Each split type requires its own participant fields to be present. */
const participantsMatchSplitType = (data, ctx) => {
  if (!data.splitType || !data.participants) return;
  data.participants.forEach((p, index) => {
    if (data.splitType === 'EXACT' && (p.amount === undefined || p.amount === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participants', index, 'amount'],
        message: 'An exact split needs an amount for every person.',
      });
    }
    if (data.splitType === 'PERCENT' && (p.percent === undefined || p.percent === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participants', index, 'percent'],
        message: 'A percentage split needs a percentage for every person.',
      });
    }
  });
};

export const createExpenseSchema = z
  .object(baseExpense)
  .strict()
  .superRefine(participantsMatchSplitType);

/** Editing replaces the whole expense, which keeps recalculation trivial to reason about. */
export const updateExpenseSchema = createExpenseSchema;

export const listExpensesQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    paidBy: objectId.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strip();
