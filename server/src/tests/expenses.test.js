import { describe, it, expect } from 'vitest';
import { as, createTestUser, createGroup } from './helpers.js';

async function trio() {
  const alice = await createTestUser({ name: 'Alice' });
  const bob = await createTestUser({ name: 'Bob' });
  const cara = await createTestUser({ name: 'Cara' });
  const group = await createGroup(alice, { name: 'Goa Trip', members: [bob, cara] });
  return { alice, bob, cara, group };
}

const equalExpense = (payer, people, over = {}) => ({
  description: 'Dinner',
  amount: '3000',
  category: 'food',
  date: '2026-03-15',
  paidBy: payer.id,
  splitType: 'EQUAL',
  participants: people.map((p) => ({ userId: p.id })),
  ...over,
});

const addExpense = (user, group, body) =>
  as(user.token).post(`/api/groups/${group.id}/expenses`).send(body);

const balancesOf = async (user, group) => {
  const res = await as(user.token).get(`/api/groups/${group.id}/balances`);
  expect(res.status).toBe(200);
  return res.body.data;
};

const netFor = (data, user) =>
  data.netBalances.find((b) => b.userId === user.id).amountPaise;

describe('equal splits through the API', () => {
  it('splits a clean amount and credits the payer', async () => {
    const { alice, bob, cara, group } = await trio();
    const res = await addExpense(alice, group, equalExpense(alice, [alice, bob, cara]));
    expect(res.status).toBe(201);
    expect(res.body.data.expense.shares.map((s) => s.amountPaise).sort()).toEqual([
      100000, 100000, 100000,
    ]);

    const data = await balancesOf(alice, group);
    expect(netFor(data, alice)).toBe(200000);
    expect(netFor(data, bob)).toBe(-100000);
    expect(netFor(data, cara)).toBe(-100000);
  });

  it('allocates indivisible paise so the shares still sum to the total', async () => {
    const { alice, bob, cara, group } = await trio();
    const res = await addExpense(
      alice,
      group,
      equalExpense(alice, [alice, bob, cara], { amount: '10' })
    );
    const shares = res.body.data.expense.shares.map((s) => s.amountPaise);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(shares.sort()).toEqual([333, 333, 334]);
  });

  it('keeps the group balanced for an awkward amount', async () => {
    const { alice, bob, cara, group } = await trio();
    await addExpense(alice, group, equalExpense(alice, [alice, bob, cara], { amount: '1234.57' }));
    const data = await balancesOf(alice, group);
    expect(data.netBalances.reduce((s, b) => s + b.amountPaise, 0)).toBe(0);
  });

  it('handles an expense the payer is not part of', async () => {
    const { alice, bob, cara, group } = await trio();
    await addExpense(alice, group, equalExpense(alice, [bob, cara], { amount: '1000' }));
    const data = await balancesOf(alice, group);
    expect(netFor(data, alice)).toBe(100000);
    expect(netFor(data, bob)).toBe(-50000);
    expect(netFor(data, cara)).toBe(-50000);
  });

  it('handles a single-participant expense', async () => {
    const { alice, group } = await trio();
    const res = await addExpense(alice, group, equalExpense(alice, [alice], { amount: '500' }));
    expect(res.status).toBe(201);
    const data = await balancesOf(alice, group);
    expect(netFor(data, alice)).toBe(0);
  });
});

describe('exact and percentage splits through the API', () => {
  it('accepts exact amounts that reconcile to the total', async () => {
    const { alice, bob, cara, group } = await trio();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob, cara]),
      splitType: 'EXACT',
      participants: [
        { userId: alice.id, amount: '1500' },
        { userId: bob.id, amount: '1000' },
        { userId: cara.id, amount: '500' },
      ],
    });
    expect(res.status).toBe(201);
    const data = await balancesOf(alice, group);
    expect(netFor(data, alice)).toBe(150000);
    expect(netFor(data, bob)).toBe(-100000);
    expect(netFor(data, cara)).toBe(-50000);
  });

  it('rejects exact amounts that do not add up', async () => {
    const { alice, bob, cara, group } = await trio();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob, cara]),
      splitType: 'EXACT',
      participants: [
        { userId: alice.id, amount: '1500' },
        { userId: bob.id, amount: '1000' },
        { userId: cara.id, amount: '400' },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/add up to the expense total/i);
  });

  it('requires an amount on every line of an exact split', async () => {
    const { alice, bob, group } = await trio();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob]),
      splitType: 'EXACT',
      participants: [{ userId: alice.id, amount: '3000' }, { userId: bob.id }],
    });
    expect(res.status).toBe(422);
  });

  it('splits by percentage and reconciles exactly', async () => {
    const { alice, bob, cara, group } = await trio();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob, cara], { amount: '1000' }),
      splitType: 'PERCENT',
      participants: [
        { userId: alice.id, percent: 50 },
        { userId: bob.id, percent: 30 },
        { userId: cara.id, percent: 20 },
      ],
    });
    expect(res.status).toBe(201);
    const shares = res.body.data.expense.shares;
    expect(shares.reduce((s, x) => s + x.amountPaise, 0)).toBe(100000);
    expect(shares.find((s) => s.userId === bob.id).amountPaise).toBe(30000);
  });

  it('rejects percentages that do not total 100', async () => {
    const { alice, bob, group } = await trio();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob]),
      splitType: 'PERCENT',
      participants: [
        { userId: alice.id, percent: 60 },
        { userId: bob.id, percent: 30 },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/add up to 100%/i);
  });
});

describe('expense validation', () => {
  it('rejects zero and negative totals', async () => {
    const { alice, bob, group } = await trio();
    for (const amount of ['0', '-500']) {
      const res = await addExpense(alice, group, equalExpense(alice, [alice, bob], { amount }));
      expect(res.status).toBe(422);
    }
  });

  it('rejects a payer who is not in the group', async () => {
    const { alice, bob, group } = await trio();
    const outsider = await createTestUser();
    const res = await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob]),
      paidBy: outsider.id,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYER_NOT_MEMBER');
  });

  it('rejects a participant who is not in the group', async () => {
    const { alice, bob, group } = await trio();
    const outsider = await createTestUser();
    const res = await addExpense(alice, group, equalExpense(alice, [alice, bob, outsider]));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PARTICIPANT_NOT_MEMBER');
  });

  it('rejects an expense with no participants', async () => {
    const { alice, group } = await trio();
    const res = await addExpense(alice, group, equalExpense(alice, []));
    expect(res.status).toBe(422);
  });

  it('writes nothing when an expense is rejected', async () => {
    const { alice, bob, cara, group } = await trio();
    await addExpense(alice, group, {
      ...equalExpense(alice, [alice, bob, cara]),
      splitType: 'EXACT',
      participants: [
        { userId: alice.id, amount: '1500' },
        { userId: bob.id, amount: '1000' },
        { userId: cara.id, amount: '400' },
      ],
    });
    const list = await as(alice.token).get(`/api/groups/${group.id}/expenses`);
    expect(list.body.data.expenses).toHaveLength(0);
    const data = await balancesOf(alice, group);
    expect(data.totals.totalExpensePaise).toBe(0);
  });
});

describe('editing and deleting expenses', () => {
  it('recalculates balances after an edit', async () => {
    const { alice, bob, cara, group } = await trio();
    const created = await addExpense(alice, group, equalExpense(alice, [alice, bob, cara]));
    const id = created.body.data.expense.id;

    const before = await balancesOf(alice, group);
    expect(netFor(before, alice)).toBe(200000);

    const updated = await as(alice.token)
      .put(`/api/groups/${group.id}/expenses/${id}`)
      .send(equalExpense(bob, [alice, bob], { amount: '1000', description: 'Taxi' }));
    expect(updated.status).toBe(200);

    const after = await balancesOf(alice, group);
    expect(netFor(after, bob)).toBe(50000);
    expect(netFor(after, alice)).toBe(-50000);
    expect(netFor(after, cara)).toBe(0);
    expect(after.totals.totalExpensePaise).toBe(100000);
  });

  it('removes an expense and its effect on balances', async () => {
    const { alice, bob, cara, group } = await trio();
    const created = await addExpense(alice, group, equalExpense(alice, [alice, bob, cara]));
    const id = created.body.data.expense.id;

    const removed = await as(alice.token).delete(`/api/groups/${group.id}/expenses/${id}`);
    expect(removed.status).toBe(200);

    const after = await balancesOf(alice, group);
    expect(after.netBalances.every((b) => b.amountPaise === 0)).toBe(true);
    expect(after.totals.totalExpensePaise).toBe(0);
    expect(after.simplifiedDebts).toHaveLength(0);
  });

  it('keeps the old allocation when an edit is rejected', async () => {
    const { alice, bob, cara, group } = await trio();
    const created = await addExpense(alice, group, equalExpense(alice, [alice, bob, cara]));
    const id = created.body.data.expense.id;

    const bad = await as(alice.token)
      .put(`/api/groups/${group.id}/expenses/${id}`)
      .send({
        ...equalExpense(alice, [alice, bob, cara]),
        splitType: 'EXACT',
        participants: [
          { userId: alice.id, amount: '1000' },
          { userId: bob.id, amount: '1000' },
          { userId: cara.id, amount: '500' },
        ],
      });
    expect(bad.status).toBe(422);

    const after = await balancesOf(alice, group);
    expect(netFor(after, alice)).toBe(200000);
    expect(after.totals.totalExpensePaise).toBe(300000);
  });

  it('404s when editing an expense from another group', async () => {
    const { alice, bob, group } = await trio();
    const other = await createGroup(alice, { name: 'Other' });
    const created = await addExpense(alice, group, equalExpense(alice, [alice, bob]));
    const res = await as(alice.token)
      .put(`/api/groups/${other.id}/expenses/${created.body.data.expense.id}`)
      .send(equalExpense(alice, [alice], { amount: '100' }));
    expect(res.status).toBe(404);
  });

  it('lists and filters group expenses', async () => {
    const { alice, bob, group } = await trio();
    await addExpense(alice, group, equalExpense(alice, [alice, bob], { description: 'Hotel', category: 'travel' }));
    await addExpense(bob, group, equalExpense(bob, [alice, bob], { description: 'Snacks' }));

    const all = await as(alice.token).get(`/api/groups/${group.id}/expenses`);
    expect(all.body.data.expenses).toHaveLength(2);

    const byCategory = await as(alice.token).get(`/api/groups/${group.id}/expenses?category=travel`);
    expect(byCategory.body.data.expenses).toHaveLength(1);

    const byPayer = await as(alice.token).get(`/api/groups/${group.id}/expenses?paidBy=${bob.id}`);
    expect(byPayer.body.data.expenses[0].description).toBe('Snacks');

    const bySearch = await as(alice.token).get(`/api/groups/${group.id}/expenses?search=hotel`);
    expect(bySearch.body.data.expenses).toHaveLength(1);
  });
});
