import mongoose from 'mongoose';
import { GROUP_TYPES } from '../utils/constants.js';

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    type: { type: String, enum: GROUP_TYPES, default: 'other' },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accentColor: { type: String, default: '#10b981' },
    archivedAt: { type: Date, default: null },
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

export const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
export default Group;
