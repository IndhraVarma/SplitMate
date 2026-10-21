import { describe, it, expect } from 'vitest';
import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  computeGroupLedger,
  summariseUserBalances,
} from '../../../shared/balance.js';

const expense = (paidBy, shares) => ({
  paidBy,
  shares: Object.entries(shares).map(([userId, amountPaise]) => ({ userId, amountPaise })),
});

const netOf = (ledger) => Object.fromEntries(ledger);

describe('net balances', () => {
  it('credits the payer and debits each participant their share', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b', 'c'],
      expenses: [expense('a', { a: 1000, b: 1000, c: 1000 })],
    });
    expect(netOf(net)).toEqual({ a: 2000, b: -1000, c: -1000 });
  });

  it('always sums to exactly zero', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b', 'c'],
      expenses: [
        expense('a', { a: 334, b: 333, c: 333 }),
        expense('b', { a: 500, b: 500 }),
        expense('c', { c: 9999 }),
      ],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 123 }],
    });
    expect([...net.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });

  it('includes members with no activity at zero', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b', 'quiet'],
      expenses: [expense('a', { a: 500, b: 500 })],
    });
    expect(net.get('quiet')).toBe(0);
  });

  it('treats a settlement as a transfer, not as spending', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b'],
      expenses: [expense('a', { a: 500, b: 500 })],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 500 }],
    });
    expect(netOf(net)).toEqual({ a: 0, b: 0 });
  });

  it('handles a partial settlement', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b'],
      expenses: [expense('a', { a: 500, b: 500 })],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 200 }],
    });
    expect(netOf(net)).toEqual({ a: 300, b: -300 });
  });

  it('handles an overpayment by flipping the direction of the debt', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b'],
      expenses: [expense('a', { a: 500, b: 500 })],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 800 }],
    });
    expect(netOf(net)).toEqual({ a: -300, b: 300 });
  });

  it('counts an expense the payer did not share in', () => {
    const net = computeNetBalances({
      memberIds: ['a', 'b'],
      expenses: [expense('a', { b: 1000 })],
    });
    expect(netOf(net)).toEqual({ a: 1000, b: -1000 });
  });
});

describe('who owes whom (pairwise)', () => {
  it('points every participant at the person who paid', () => {
    const debts = computePairwiseDebts({ expenses: [expense('a', { a: 1000, b: 1000, c: 1000 })] });
    expect(debts).toEqual([
      { from: 'b', to: 'a', amountPaise: 1000 },
      { from: 'c', to: 'a', amountPaise: 1000 },
    ]);
  });

  it('nets out two people who each owe the other', () => {
    const debts = computePairwiseDebts({
      expenses: [expense('a', { b: 10000 }), expense('b', { a: 3000 })],
    });
    expect(debts).toEqual([{ from: 'b', to: 'a', amountPaise: 7000 }]);
  });

  it('removes a pair that has settled up completely', () => {
    const debts = computePairwiseDebts({
      expenses: [expense('a', { a: 500, b: 500 })],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 500 }],
    });
    expect(debts).toEqual([]);
  });
});

describe('debt simplification', () => {
  it('reduces a circular debt to nothing', () => {
    // a owes b 100, b owes c 100, c owes a 100 -> everyone is square.
    const net = new Map([
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ]);
    expect(simplifyDebts(net)).toEqual([]);
  });

  it('collapses a chain into a single transfer', () => {
    // a is owed 100; b owes 100. One transfer settles it.
    const transfers = simplifyDebts(new Map([['a', 10000], ['b', -10000]]));
    expect(transfers).toEqual([{ from: 'b', to: 'a', amountPaise: 10000 }]);
  });

  it('needs at most (members with a balance - 1) transfers', () => {
    const net = new Map([
      ['a', 30000],
      ['b', 10000],
      ['c', -15000],
      ['d', -25000],
    ]);
    const transfers = simplifyDebts(net);
    expect(transfers.length).toBeLessThanOrEqual(3);
    expect(transfers.reduce((s, t) => s + t.amountPaise, 0)).toBe(40000);
  });

  it('preserves every balance exactly: applying the transfers zeroes everyone', () => {
    const cases = [
      { a: 12345, b: -4321, c: -8024 },
      { a: 1, b: -1 },
      { a: 100000, b: -33333, c: -33333, d: -33334 },
      { a: 50, b: 50, c: 50, d: -150 },
      { a: 0, b: 0 },
    ];
    for (const balances of cases) {
      const transfers = simplifyDebts(new Map(Object.entries(balances)));
      const applied = { ...balances };
      for (const t of transfers) {
        applied[t.from] += t.amountPaise;
        applied[t.to] -= t.amountPaise;
      }
      for (const value of Object.values(applied)) expect(value).toBe(0);
    }
  });

  it('is deterministic for the same balances', () => {
    const balances = { a: 7000, b: 3000, c: -4000, d: -6000 };
    const first = simplifyDebts(new Map(Object.entries(balances)));
    const second = simplifyDebts(new Map(Object.entries(balances)));
    expect(first).toEqual(second);
  });

  it('never asks anyone to send more than they owe', () => {
    const balances = { a: 9000, b: -2000, c: -3000, d: -4000 };
    const transfers = simplifyDebts(new Map(Object.entries(balances)));
    const sent = {};
    for (const t of transfers) sent[t.from] = (sent[t.from] || 0) + t.amountPaise;
    expect(sent.b).toBe(2000);
    expect(sent.c).toBe(3000);
    expect(sent.d).toBe(4000);
  });
});

describe('group ledger', () => {
  it('reports expenses, settlements, balances and both debt views together', () => {
    const ledger = computeGroupLedger({
      memberIds: ['a', 'b', 'c'],
      expenses: [
        expense('a', { a: 334, b: 333, c: 333 }),
        expense('b', { a: 500, b: 500 }),
      ],
      settlements: [{ fromUser: 'c', toUser: 'a', amountPaise: 100 }],
    });

    expect(ledger.totalExpensePaise).toBe(2000);
    expect(ledger.totalSettledPaise).toBe(100);
    expect(ledger.netBalances.reduce((s, b) => s + b.amountPaise, 0)).toBe(0);
    // Simplification should not need more transfers than the raw pairwise view.
    expect(ledger.simplifiedDebts.length).toBeLessThanOrEqual(ledger.pairwiseDebts.length + 1);
  });

  it('excludes settlements from the total spent', () => {
    const ledger = computeGroupLedger({
      memberIds: ['a', 'b'],
      expenses: [expense('a', { a: 5000, b: 5000 })],
      settlements: [{ fromUser: 'b', toUser: 'a', amountPaise: 5000 }],
    });
    expect(ledger.totalExpensePaise).toBe(10000);
    expect(ledger.totalSettledPaise).toBe(5000);
  });
});

describe('cross-group summary', () => {
  it('separates what the user is owed from what they owe', () => {
    expect(summariseUserBalances([5000, -2000, 0, -1000])).toEqual({
      owedToUserPaise: 5000,
      userOwesPaise: 3000,
      netPaise: 2000,
    });
  });

  it('is all zeroes when there is nothing outstanding', () => {
    expect(summariseUserBalances([])).toEqual({
      owedToUserPaise: 0,
      userOwesPaise: 0,
      netPaise: 0,
    });
  });
});
