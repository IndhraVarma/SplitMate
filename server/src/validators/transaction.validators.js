import { z } from 'zod';
import { positivePaise, dateString, objectId } from './common.js';
import {
  TRANSACTION_TYPES,
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from '../utils/constants.js';

const baseFields = {
  type: z.enum(TRANSACTION_TYPES),
  amount: positivePaise,
  category: z.enum(ALL_CATEGORIES),
  description: z.string().trim().max(200).optional().default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default('other'),
  date: dateString,
  notes: z.string().trim().max(500).optional().default(''),
};

/** A category must belong to the list for the chosen transaction type. */
const categoryMatchesType = (data, ctx) => {
  if (!data.type || !data.category) return;
  const allowed = data.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!allowed.includes(data.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: `"${data.category}" is not a valid ${data.type} category.`,
    });
  }
};

export const createTransactionSchema = z.object(baseFields).strict().superRefine(categoryMatchesType);

export const updateTransactionSchema = z
  .object({
    type: baseFields.type.optional(),
    amount: positivePaise.optional(),
    category: baseFields.category.optional(),
    description: z.string().trim().max(200).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    date: dateString.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update.' });

export const listTransactionsQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    category: z.enum(ALL_CATEGORIES).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(['date', '-date', 'amount', '-amount']).optional().default('-date'),
  })
  .strip();

export const summaryQuery = z
  .object({
    year: z.coerce.number().int().min(2000).max(2200).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strip();

export const transactionIdParam = z.object({ id: objectId });
