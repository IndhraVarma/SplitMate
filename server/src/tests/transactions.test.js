import { describe, it, expect } from 'vitest';
import { as, createTestUser } from './helpers.js';

const tx = (over = {}) => ({
  type: 'expense',
  amount: '450.75',
  category: 'food',
  description: 'Lunch',
  paymentMethod: 'upi',
  date: '2026-03-15',
  ...over,
});

describe('personal transactions', () => {
  it('creates a transaction, storing the amount as integer paise', async () => {
    const user = await createTestUser();
    const res = await as(user.token).post('/api/transactions').send(tx());
    expect(res.status).toBe(201);
    expect(res.body.data.transaction.amountPaise).toBe(45075);
  });

  it('accepts a rupee amount typed with a comma', async () => {
    const user = await createTestUser();
    const res = await as(user.token).post('/api/transactions').send(tx({ amount: '1,250.50' }));
    expect(res.body.data.transaction.amountPaise).toBe(125050);
  });

  it('rejects zero and negative amounts', async () => {
    const user = await createTestUser();
    for (const amount of ['0', '-100', 0, -1]) {
      const res = await as(user.token).post('/api/transactions').send(tx({ amount }));
      expect(res.status).toBe(422);
    }
  });

  it('rejects an income category on an expense', async () => {
    const user = await createTestUser();
    const res = await as(user.token).post('/api/transactions').send(tx({ category: 'salary' }));
    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d) => d.field === 'category')).toBe(true);
  });

  it('accepts an income transaction with an income category', async () => {
    const user = await createTestUser();
    const res = await as(user.token)
      .post('/api/transactions')
      .send(tx({ type: 'income', category: 'salary', amount: '65000' }));
    expect(res.status).toBe(201);
    expect(res.body.data.transaction.amountPaise).toBe(6500000);
  });

  it('lists, updates and deletes a transaction', async () => {
    const user = await createTestUser();
    const created = await as(user.token).post('/api/transactions').send(tx());
    const id = created.body.data.transaction.id;

    const list = await as(user.token).get('/api/transactions');
    expect(list.body.data.transactions).toHaveLength(1);
    expect(list.body.meta.total).toBe(1);

    const updated = await as(user.token)
      .patch(`/api/transactions/${id}`)
      .send({ amount: '500', description: 'Dinner' });
    expect(updated.body.data.transaction.amountPaise).toBe(50000);
    expect(updated.body.data.transaction.description).toBe('Dinner');

    const removed = await as(user.token).delete(`/api/transactions/${id}`);
    expect(removed.status).toBe(200);

    const after = await as(user.token).get('/api/transactions');
    expect(after.body.data.transactions).toHaveLength(0);
  });

  it('filters by type, category, date range and search text', async () => {
    const user = await createTestUser();
    await as(user.token).post('/api/transactions').send(tx({ description: 'Cafe lunch' }));
    await as(user.token)
      .post('/api/transactions')
      .send(tx({ category: 'transportation', description: 'Metro card', date: '2026-04-02' }));
    await as(user.token)
      .post('/api/transactions')
      .send(tx({ type: 'income', category: 'salary', description: 'March pay' }));

    const expenses = await as(user.token).get('/api/transactions?type=expense');
    expect(expenses.body.data.transactions).toHaveLength(2);

    const food = await as(user.token).get('/api/transactions?category=food');
    expect(food.body.data.transactions).toHaveLength(1);

    const march = await as(user.token).get('/api/transactions?from=2026-03-01&to=2026-03-31');
    expect(march.body.data.transactions).toHaveLength(2);

    const search = await as(user.token).get('/api/transactions?search=metro');
    expect(search.body.data.transactions).toHaveLength(1);
  });

  it('treats regex characters in a search as literal text', async () => {
    const user = await createTestUser();
    await as(user.token).post('/api/transactions').send(tx({ description: 'Coffee (large)' }));
    const res = await as(user.token).get('/api/transactions?search=(large)');
    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(1);
  });

  it('paginates', async () => {
    const user = await createTestUser();
    for (let i = 0; i < 5; i += 1) {
      await as(user.token).post('/api/transactions').send(tx({ description: `Item ${i}` }));
    }
    const page = await as(user.token).get('/api/transactions?page=2&limit=2');
    expect(page.body.data.transactions).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('transaction access isolation', () => {
  it('does not show one user the other user transactions', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    await as(alice.token).post('/api/transactions').send(tx());

    const bobList = await as(bob.token).get('/api/transactions');
    expect(bobList.body.data.transactions).toHaveLength(0);
  });

  it('returns 404 when a user asks for another user transaction by id', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const created = await as(alice.token).post('/api/transactions').send(tx());
    const id = created.body.data.transaction.id;

    expect((await as(bob.token).get(`/api/transactions/${id}`)).status).toBe(404);
    expect((await as(bob.token).patch(`/api/transactions/${id}`).send({ amount: '1' })).status).toBe(404);
    expect((await as(bob.token).delete(`/api/transactions/${id}`)).status).toBe(404);

    // ...and the original is untouched.
    const still = await as(alice.token).get(`/api/transactions/${id}`);
    expect(still.body.data.transaction.amountPaise).toBe(45075);
  });

  it('requires authentication for every transaction route', async () => {
    const { request, app } = await import('./helpers.js');
    for (const call of [
      request(app).get('/api/transactions'),
      request(app).post('/api/transactions').send(tx()),
      request(app).get('/api/transactions/summary'),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
    }
  });

  it('rejects an id that is not a valid ObjectId', async () => {
    const user = await createTestUser();
    const res = await as(user.token).get('/api/transactions/not-an-id');
    expect(res.status).toBe(422);
  });
});
