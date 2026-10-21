import { describe, it, expect } from 'vitest';
import { as, createTestUser } from './helpers.js';

const post = (user, body) => as(user.token).post('/api/transactions').send(body);

async function seedMarch(user) {
  await post(user, { type: 'income', amount: '50000', category: 'salary', date: '2026-03-01' });
  await post(user, { type: 'expense', amount: '12000', category: 'rent', date: '2026-03-02' });
  await post(user, { type: 'expense', amount: '3000.50', category: 'food', date: '2026-03-10' });
  await post(user, { type: 'expense', amount: '1999.50', category: 'food', date: '2026-03-20' });
  // Outside the window - must not be counted in a March summary.
  await post(user, { type: 'expense', amount: '9999', category: 'shopping', date: '2026-04-05' });
}

describe('summaries', () => {
  it('computes income, expenses and the cash-flow balance for a month', async () => {
    const user = await createTestUser();
    await seedMarch(user);

    const res = await as(user.token).get('/api/transactions/summary?year=2026&month=3');
    expect(res.status).toBe(200);
    expect(res.body.data.totalIncomePaise).toBe(5000000);
    expect(res.body.data.totalExpensePaise).toBe(1200000 + 300050 + 199950);
    expect(res.body.data.balancePaise).toBe(
      res.body.data.totalIncomePaise - res.body.data.totalExpensePaise
    );
  });

  it('excludes transactions outside the requested month', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    const march = await as(user.token).get('/api/transactions/summary?year=2026&month=3');
    const april = await as(user.token).get('/api/transactions/summary?year=2026&month=4');
    expect(april.body.data.totalExpensePaise).toBe(999900);
    expect(march.body.data.totalExpensePaise).not.toBe(april.body.data.totalExpensePaise);
  });

  it('returns zeroes rather than nulls when there is nothing yet', async () => {
    const user = await createTestUser();
    const res = await as(user.token).get('/api/transactions/summary?year=2026&month=1');
    expect(res.body.data).toMatchObject({
      totalIncomePaise: 0,
      totalExpensePaise: 0,
      balancePaise: 0,
    });
  });

  it('includes a day-boundary transaction on the last day of the range', async () => {
    const user = await createTestUser();
    await post(user, { type: 'expense', amount: '100', category: 'food', date: '2026-03-31' });
    const res = await as(user.token).get('/api/transactions/summary?from=2026-03-01&to=2026-03-31');
    expect(res.body.data.totalExpensePaise).toBe(10000);
  });
});

describe('category breakdown', () => {
  it('groups spending by category, largest first, with shares in basis points', async () => {
    const user = await createTestUser();
    await seedMarch(user);

    const res = await as(user.token).get('/api/transactions/analytics/categories?year=2026&month=3');
    const { categories, totalPaise } = res.body.data;

    expect(categories[0].category).toBe('rent');
    expect(categories[0].totalPaise).toBe(1200000);
    expect(categories.find((c) => c.category === 'food').totalPaise).toBe(500000);
    expect(categories.reduce((s, c) => s + c.totalPaise, 0)).toBe(totalPaise);
    const shareSum = categories.reduce((s, c) => s + c.shareBasisPoints, 0);
    expect(Math.abs(shareSum - 10000)).toBeLessThanOrEqual(categories.length);
  });

  it('ignores income when breaking down spending', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    const res = await as(user.token).get('/api/transactions/analytics/categories?year=2026&month=3');
    expect(res.body.data.categories.some((c) => c.category === 'salary')).toBe(false);
  });
});

describe('monthly trend', () => {
  it('returns twelve months, zero-filled', async () => {
    const user = await createTestUser();
    await seedMarch(user);
    const res = await as(user.token).get('/api/transactions/analytics/monthly?year=2026');
    expect(res.body.data.months).toHaveLength(12);
    expect(res.body.data.months[2]).toMatchObject({ month: 3, incomePaise: 5000000 });
    expect(res.body.data.months[0]).toMatchObject({ month: 1, incomePaise: 0, expensePaise: 0 });
  });

  it('keeps each user trend separate', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    await seedMarch(alice);
    const res = await as(bob.token).get('/api/transactions/analytics/monthly?year=2026');
    expect(res.body.data.months.every((m) => m.incomePaise === 0 && m.expensePaise === 0)).toBe(true);
  });
});
