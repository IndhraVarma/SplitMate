import { describe, it, expect } from 'vitest';
import { as, createTestUser } from './helpers.js';

const post = (user, body) => as(user.token).post('/api/transactions').send(body);

async function seedMarch(user) {
  await post(user, { type: 'expense', amount: '12000', category: 'rent', date: '2026-03-02' });
  await post(user, { type: 'expense', amount: '3000.50', category: 'food', date: '2026-03-10' });
  await post(user, { type: 'expense', amount: '1999.50', category: 'food', date: '2026-03-20' });
}

describe('budgets', () => {
  it('sets a budget and reports spending against it', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    const created = await as(user.token)
      .post('/api/budgets')
      .send({ category: 'food', year: 2026, month: 3, limit: '6000' });
    expect(created.status).toBe(201);
    expect(created.body.data.budget.limitPaise).toBe(600000);

    const summary = await as(user.token).get('/api/budgets?year=2026&month=3');
    const food = summary.body.data.items.find((i) => i.category === 'food');
    expect(food.spentPaise).toBe(500000);
    expect(food.remainingPaise).toBe(100000);
    expect(food.usedBasisPoints).toBe(8333);
    expect(food.isOverBudget).toBe(false);
  });

  it('flags a category that is over budget', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    await as(user.token)
      .post('/api/budgets')
      .send({ category: 'food', year: 2026, month: 3, limit: '1000' });
    const summary = await as(user.token).get('/api/budgets?year=2026&month=3');
    const food = summary.body.data.items.find((i) => i.category === 'food');
    expect(food.isOverBudget).toBe(true);
    expect(food.remainingPaise).toBe(-400000);
    expect(summary.body.data.totals.overBudgetCount).toBe(1);
  });

  it('treats a repeat submission as an update, not a duplicate', async () => {
    const user = await createTestUser();
    const body = { category: 'food', year: 2026, month: 3, limit: '6000' };
    const first = await as(user.token).post('/api/budgets').send(body);
    const second = await as(user.token).post('/api/budgets').send({ ...body, limit: '7000' });
    expect(second.status).toBe(201);
    expect(second.body.data.budget.id).toBe(first.body.data.budget.id);
    expect(second.body.data.budget.limitPaise).toBe(700000);

    const summary = await as(user.token).get('/api/budgets?year=2026&month=3');
    expect(summary.body.data.items).toHaveLength(1);
  });

  it('lists spending in categories that have no budget', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    await as(user.token)
      .post('/api/budgets')
      .send({ category: 'food', year: 2026, month: 3, limit: '6000' });
    const summary = await as(user.token).get('/api/budgets?year=2026&month=3');
    expect(summary.body.data.unbudgetedSpending.map((u) => u.category)).toContain('rent');
  });

  it('rejects a budget on an income category', async () => {
    const user = await createTestUser();
    const res = await as(user.token)
      .post('/api/budgets')
      .send({ category: 'salary', year: 2026, month: 3, limit: '6000' });
    expect(res.status).toBe(422);
  });

  it('keeps budgets private to their owner', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const created = await as(alice.token)
      .post('/api/budgets')
      .send({ category: 'food', year: 2026, month: 3, limit: '6000' });

    const bobSummary = await as(bob.token).get('/api/budgets?year=2026&month=3');
    expect(bobSummary.body.data.items).toHaveLength(0);

    const bobDelete = await as(bob.token).delete(`/api/budgets/${created.body.data.budget.id}`);
    expect(bobDelete.status).toBe(404);
  });
});
