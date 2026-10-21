import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/logout', controller.logout);

router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), controller.updateMe);
router.post(
  '/change-password',
  authenticate,
  authLimiter,
  validate({ body: changePasswordSchema }),
  controller.changePassword
);

router.get(
  '/users/search',
  authenticate,
  validate({ query: z.object({ q: z.string().trim().min(3).max(60) }).strip() }),
  controller.searchUsers
);

export default router;
