import mongoose from 'mongoose';

/**
 * One member's allocated portion of one group expense. The invariant enforced
 * by the service layer is that the shares of an expense sum EXACTLY to the
 * expense total, in integer paise.
 */
const expenseShareSchema = new mongoose.Schema(
  {
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupExpense',
      required: true,
      index: true,
    },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountPaise: {
      type: Number,
      required: true,
      min: [0, 'A share cannot be negative.'],
      validate: { validator: Number.isSafeInteger, message: 'A share must be whole paise.' },
    },
    /** Only set for PERCENT splits; kept so an edit screen can show the original input. */
    basisPoints: { type: Number, default: null },
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

expenseShareSchema.index({ expense: 1, user: 1 }, { unique: true });
expenseShareSchema.index({ group: 1, user: 1 });

export const ExpenseShare =
  mongoose.models.ExpenseShare || mongoose.model('ExpenseShare', expenseShareSchema);
export default ExpenseShare;
