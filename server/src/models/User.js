import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
    },
    // `select: false` means the hash is never loaded unless a query explicitly
    // asks for it, so it cannot leak through a careless res.json(user).
    passwordHash: { type: String, required: true, select: false },
    avatarColor: { type: String, default: '#10b981' },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

/** Hash a plaintext password with the configured bcrypt cost. */
userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) {
    throw new Error('passwordHash was not selected on this document.');
  }
  return bcrypt.compare(plain, this.passwordHash);
};

/** The shape of a user that is safe to return in any API response. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatarColor: this.avatarColor,
    currency: this.currency,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
