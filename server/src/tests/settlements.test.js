import { describe, it, expect } from 'vitest';
import { as, createTestUser, createGroup } from './helpers.js';
import { Settlement } from '../models/Settlement.js';

async function trioWithDinner() {
  const alice = await createTestUser({ name: 'Alice' });
  const bob = await createTestUser({ name: 'Bob' });
  const cara = await createTestUser({ name: 'Cara' });
  const group = await createGroup(alice, { name: 'Goa Trip', members: [bob, cara] });
  // Alice pays 3000, split equally three ways: Bob and Cara owe her 1000 each.
  await as(alice.token).post(`/api/groups/${group.id}/expenses`).send({
    description: 'Dinner',
    amount: '3000',
    category: 'food',
    date: '2026-03-15',
    paidBy: alice.id,
    splitType: 'EQUAL',
    participants: [{ userId: alice.id }, { userId: bob.id }, { userId: cara.id }],
  });
  return { alice, bob, cara, group };
}

const settle = (user, group, body) =>
  as(user.token).post(`/api/groups/${group.id}/settlements`).send(body);

const balancesOf = async (user, group) =>
  (await as(user.token).get(`/api/groups/${group.id}/balances`)).body.data;

const netFor = (data, user) => data.netBalances.find((b) => b.userId === user.id).amountPaise;

describe('recording settlements', () => {
  it('clears a debt with a full settlement', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const res = await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    expect(res.status).toBe(201);

    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(0);
    expect(netFor(data, alice)).toBe(100000);
  });

  it('reduces a debt with a partial settlement', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '400' });

    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(-60000);
    const owed = data.pairwiseDebts.find((d) => d.from.userId === bob.id);
    expect(owed.amountPaise).toBe(60000);
  });

  it('allows several partial settlements that add up to the debt', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '400' });
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '600' });

    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(0);
    expect(data.totals.totalSettledPaise).toBe(100000);
  });

  it('flips the balance when someone over-settles', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1500' });

    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(50000);
  });

  it('never counts a settlement as group spending', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });

    const data = await balancesOf(alice, group);
    expect(data.totals.totalExpensePaise).toBe(300000);
    expect(data.totals.totalSettledPaise).toBe(100000);

    const expenses = await as(alice.token).get(`/api/groups/${group.id}/expenses`);
    expect(expenses.body.data.expenses).toHaveLength(1);
  });

  it('keeps the group balanced after a settlement', async () => {
    const { alice, bob, cara, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '333.33' });
    await settle(cara, group, { fromUser: cara.id, toUser: alice.id, amount: '1000' });

    const data = await balancesOf(alice, group);
    expect(data.netBalances.reduce((s, b) => s + b.amountPaise, 0)).toBe(0);
  });
});

describe('settlement validation', () => {
  it('rejects a settlement with someone outside the group', async () => {
    const { alice, group } = await trioWithDinner();
    const outsider = await createTestUser();
    const res = await settle(alice, group, {
      fromUser: alice.id,
      toUser: outsider.id,
      amount: '100',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_MEMBER');
  });

  it('rejects a settlement with oneself', async () => {
    const { alice, group } = await trioWithDinner();
    const res = await settle(alice, group, { fromUser: alice.id, toUser: alice.id, amount: '100' });
    expect(res.status).toBe(422);
  });

  it('rejects zero and negative amounts', async () => {
    const { alice, bob, group } = await trioWithDinner();
    for (const amount of ['0', '-100']) {
      const res = await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount });
      expect(res.status).toBe(422);
    }
  });

  it('refuses a settlement recorded by a non-member', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const mallory = await createTestUser();
    const res = await settle(mallory, group, {
      fromUser: bob.id,
      toUser: alice.id,
      amount: '1000',
    });
    expect(res.status).toBe(404);
  });
});

describe('duplicate settlement submissions', () => {
  it('records a repeated submission only once when an idempotency key is sent', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const body = {
      fromUser: bob.id,
      toUser: alice.id,
      amount: '1000',
      clientRequestId: 'form-submit-abc12345',
    };

    const first = await settle(bob, group, body);
    const second = await settle(bob, group, body);

    expect(first.status).toBe(201);
    expect(first.body.data.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.settlement.id).toBe(first.body.data.settlement.id);

    expect(await Settlement.countDocuments({ group: group.id })).toBe(1);
    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(0);
  });

  it('is safe under concurrent duplicate submissions', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const body = {
      fromUser: bob.id,
      toUser: alice.id,
      amount: '1000',
      clientRequestId: 'double-tap-xyz98765',
    };

    const results = await Promise.all([
      settle(bob, group, body),
      settle(bob, group, body),
      settle(bob, group, body),
    ]);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await Settlement.countDocuments({ group: group.id })).toBe(1);
  });

  it('records two genuine settlements when no idempotency key is sent', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const body = { fromUser: bob.id, toUser: alice.id, amount: '500' };
    await settle(bob, group, body);
    await settle(bob, group, body);
    expect(await Settlement.countDocuments({ group: group.id })).toBe(2);
  });
});

describe('settlement history', () => {
  it('lists settlements newest first with both people named', async () => {
    const { alice, bob, cara, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000', settledAt: '2026-03-20' });
    await settle(cara, group, { fromUser: cara.id, toUser: alice.id, amount: '500', settledAt: '2026-03-25' });

    const res = await as(alice.token).get(`/api/groups/${group.id}/settlements`);
    expect(res.status).toBe(200);
    expect(res.body.data.settlements).toHaveLength(2);
    expect(res.body.data.settlements[0].from.name).toBe('Cara');
    expect(res.body.data.settlements[0].to.name).toBe('Alice');
  });

  it('filters history by person', async () => {
    const { alice, bob, cara, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    await settle(cara, group, { fromUser: cara.id, toUser: alice.id, amount: '500' });

    const res = await as(alice.token).get(`/api/groups/${group.id}/settlements?userId=${bob.id}`);
    expect(res.body.data.settlements).toHaveLength(1);
    expect(res.body.data.settlements[0].from.userId).toBe(bob.id);
  });

  it('hides settlement history from non-members', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const mallory = await createTestUser();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    const res = await as(mallory.token).get(`/api/groups/${group.id}/settlements`);
    expect(res.status).toBe(404);
  });

  it('restores the balance when a settlement is deleted', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const created = await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    const id = created.body.data.settlement.id;

    const removed = await as(bob.token).delete(`/api/groups/${group.id}/settlements/${id}`);
    expect(removed.status).toBe(200);

    const data = await balancesOf(alice, group);
    expect(netFor(data, bob)).toBe(-100000);
  });

  it('stops an unrelated member deleting someone else settlement', async () => {
    const { alice, bob, cara, group } = await trioWithDinner();
    const created = await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    const res = await as(cara.token)
      .delete(`/api/groups/${group.id}/settlements/${created.body.data.settlement.id}`);
    expect(res.status).toBe(403);
  });
});

describe('simplified debts through the API', () => {
  it('turns a chain of debts into fewer transfers', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const cara = await createTestUser({ name: 'Cara' });
    const group = await createGroup(alice, { name: 'Flat', members: [bob, cara] });

    const expense = (payer, amount) =>
      as(payer.token).post(`/api/groups/${group.id}/expenses`).send({
        description: 'Shared',
        amount,
        date: '2026-03-01',
        paidBy: payer.id,
        splitType: 'EQUAL',
        participants: [{ userId: alice.id }, { userId: bob.id }, { userId: cara.id }],
      });

    await expense(alice, '3000');
    await expense(bob, '1500');

    const data = await balancesOf(alice, group);
    // Three members, so at most two transfers are ever needed.
    expect(data.simplifiedDebts.length).toBeLessThanOrEqual(2);

    // Applying the suggested transfers must zero every balance.
    const applied = Object.fromEntries(data.netBalances.map((b) => [b.userId, b.amountPaise]));
    for (const t of data.simplifiedDebts) {
      applied[t.from.userId] += t.amountPaise;
      applied[t.to.userId] -= t.amountPaise;
    }
    expect(Object.values(applied).every((v) => v === 0)).toBe(true);
  });

  it('reports nothing to settle once the group is square', async () => {
    const { alice, bob, cara, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    await settle(cara, group, { fromUser: cara.id, toUser: alice.id, amount: '1000' });

    const data = await balancesOf(alice, group);
    expect(data.simplifiedDebts).toHaveLength(0);
    expect(data.pairwiseDebts).toHaveLength(0);
    expect(data.netBalances.every((b) => b.amountPaise === 0)).toBe(true);
  });

  it('names every member in the balances view, including those with nothing outstanding', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const group = await createGroup(alice, { name: 'Quiet', members: [bob] });
    const data = await balancesOf(alice, group);
    expect(data.netBalances).toHaveLength(2);
    expect(data.netBalances.map((b) => b.name).sort()).toEqual(['Alice', 'Bob']);
  });
});

describe('member removal and balances', () => {
  it('refuses to remove a member who still owes money', async () => {
    const { alice, bob, group } = await trioWithDinner();
    const res = await as(alice.token).delete(`/api/groups/${group.id}/members/${bob.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_HAS_BALANCE');
  });

  it('removes a member once they are square', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    const res = await as(alice.token).delete(`/api/groups/${group.id}/members/${bob.id}`);
    expect(res.status).toBe(200);

    const detail = await as(alice.token).get(`/api/groups/${group.id}`);
    const bobRow = detail.body.data.members.find((m) => m.userId === bob.id);
    expect(bobRow.status).toBe('removed');

    // Their historic expense share is still counted, so the group stays balanced.
    const data = await balancesOf(alice, group);
    expect(data.netBalances.reduce((s, b) => s + b.amountPaise, 0)).toBe(0);
  });

  it('cuts off a removed member from the group', async () => {
    const { alice, bob, group } = await trioWithDinner();
    await settle(bob, group, { fromUser: bob.id, toUser: alice.id, amount: '1000' });
    await as(alice.token).delete(`/api/groups/${group.id}/members/${bob.id}`);

    const res = await as(bob.token).get(`/api/groups/${group.id}`);
    expect(res.status).toBe(404);
  });
});
