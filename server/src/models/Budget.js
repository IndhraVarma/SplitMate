import mongoose from 'mongoose';
import { EXPENSE_CATEGORIES } from '../utils/constants.js';

/**
 * A monthly spending cap for one category. One document per
 * (user, year, month, category) - enforced by a unique index so a double
 * submit updates rather than duplicates.
 */
const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    year: { type: Number, required: true, min: 2000, max: 2200 },
    month: { type: Number, required: true, min: 1, max: 12 },
    /** Integer paise. */
    limitPaise: {
      type: Number,
      required: true,
      min: [1, 'Budget must be greater than zero.'],
      validate: { validator: Number.isSafeInteger, message: 'Budget must be whole paise.' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

budgetSchema.index({ user: 1, year: 1, month: 1, category: 1 }, { unique: true });

export const Budget = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);
export default Budget;
