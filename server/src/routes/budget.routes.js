import { Router } from 'express';
import * as controller from '../controllers/budget.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { upsertBudgetSchema, budgetQuery } from '../validators/budget.validators.js';
import { idParam } from '../validators/common.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: budgetQuery }), controller.summary);
router.post('/', validate({ body: upsertBudgetSchema }), controller.upsert);
router.delete('/:id', validate({ params: idParam }), controller.remove);

export default router;
