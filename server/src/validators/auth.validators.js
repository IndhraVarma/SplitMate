import { z } from 'zod';

/**
 * Password policy: at least 8 characters with a letter and a number. Long
 * enough to resist guessing, simple enough that the rule can be stated in the
 * UI in one line.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Please enter a valid email address.');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(60),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    avatarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour.')
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update.' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Your current password is required.'),
    newPassword: passwordSchema,
  })
  .strict();
