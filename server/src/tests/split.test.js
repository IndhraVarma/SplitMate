import { describe, it, expect } from 'vitest';
import {
  splitEqually,
  splitExactly,
  splitByPercentage,
  computeShares,
  percentToBasisPoints,
} from '../../../shared/split.js';
import { MoneyError } from '../../../shared/money.js';

const total = (shares) => shares.reduce((acc, s) => acc + s.amountPaise, 0);

describe('equal splits', () => {
  it('splits evenly when the amount divides cleanly', () => {
    const shares = splitEqually(90000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amountPaise)).toEqual([30000, 30000, 30000]);
    expect(total(shares)).toBe(90000);
  });

  it('gives the indivisible paise to the first participants, in order', () => {
    // 1000 paise over 3 people: 333.33 each. The 1 stray paise goes to "a".
    const shares = splitEqually(1000, ['a', 'b', 'c']);
    expect(shares).toEqual([
      { userId: 'a', amountPaise: 334 },
      { userId: 'b', amountPaise: 333 },
      { userId: 'c', amountPaise: 333 },
    ]);
    expect(total(shares)).toBe(1000);
  });

  it('never loses or invents a paise, for any amount or party size', () => {
    for (let people = 1; people <= 17; people += 1) {
      const ids = Array.from({ length: people }, (_, i) => `u${i}`);
      for (const amount of [1, 2, 7, 99, 100, 101, 999, 100000, 123457]) {
        const shares = splitEqually(amount, ids);
        expect(total(shares)).toBe(amount);
        // No share may differ from another by more than one paise.
        const amounts = shares.map((s) => s.amountPaise);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles a single participant', () => {
    expect(splitEqually(999, ['solo'])).toEqual([{ userId: 'solo', amountPaise: 999 }]);
  });

  it('handles an amount smaller than the number of people', () => {
    // 2 paise across 5 people: two people pay 1 paise, three pay nothing.
    const shares = splitEqually(2, ['a', 'b', 'c', 'd', 'e']);
    expect(shares.map((s) => s.amountPaise)).toEqual([1, 1, 0, 0, 0]);
    expect(total(shares)).toBe(2);
  });

  it('rejects zero, negative and empty inputs', () => {
    expect(() => splitEqually(0, ['a'])).toThrow(MoneyError);
    expect(() => splitEqually(-100, ['a'])).toThrow(MoneyError);
    expect(() => splitEqually(100, [])).toThrow(MoneyError);
    expect(() => splitEqually(10.5, ['a'])).toThrow(MoneyError);
  });

  it('rejects the same person listed twice', () => {
    expect(() => splitEqually(100, ['a', 'a'])).toThrow(/duplicate participant/i);
  });
});

describe('exact splits', () => {
  it('accepts shares that add up to the total', () => {
    const shares = splitExactly(10000, [
      { userId: 'a', amountPaise: 6000 },
      { userId: 'b', amountPaise: 4000 },
    ]);
    expect(total(shares)).toBe(10000);
  });

  it('allows a participant with a zero share', () => {
    const shares = splitExactly(10000, [
      { userId: 'a', amountPaise: 10000 },
      { userId: 'b', amountPaise: 0 },
    ]);
    expect(total(shares)).toBe(10000);
  });

  it('rejects allocations that do not reconcile to the total', () => {
    expect(() =>
      splitExactly(10000, [
        { userId: 'a', amountPaise: 6000 },
        { userId: 'b', amountPaise: 3999 },
      ])
    ).toThrow(/add up to the expense total/i);

    expect(() =>
      splitExactly(10000, [
        { userId: 'a', amountPaise: 6000 },
        { userId: 'b', amountPaise: 4001 },
      ])
    ).toThrow(/add up to the expense total/i);
  });

  it('rejects negative shares', () => {
    expect(() =>
      splitExactly(10000, [
        { userId: 'a', amountPaise: 12000 },
        { userId: 'b', amountPaise: -2000 },
      ])
    ).toThrow(/cannot be negative/i);
  });
});

describe('percentage splits', () => {
  it('converts typed percentages to basis points', () => {
    expect(percentToBasisPoints(33.33)).toBe(3333);
    expect(percentToBasisPoints('50')).toBe(5000);
    expect(percentToBasisPoints(100)).toBe(10000);
  });

  it('allocates by percentage and reconciles to the total exactly', () => {
    const shares = splitByPercentage(100000, [
      { userId: 'a', basisPoints: 5000 },
      { userId: 'b', basisPoints: 3000 },
      { userId: 'c', basisPoints: 2000 },
    ]);
    expect(shares.map((s) => s.amountPaise)).toEqual([50000, 30000, 20000]);
    expect(total(shares)).toBe(100000);
  });

  it('uses the largest remainder to place indivisible paise', () => {
    // 1000 paise at 33.33 / 33.33 / 33.34 -> floors are 333/333/333, leaving
    // 1 paise, which goes to the largest fractional remainder (c).
    const shares = splitByPercentage(1000, [
      { userId: 'a', basisPoints: 3333 },
      { userId: 'b', basisPoints: 3333 },
      { userId: 'c', basisPoints: 3334 },
    ]);
    expect(shares).toEqual([
      { userId: 'a', amountPaise: 333 },
      { userId: 'b', amountPaise: 333 },
      { userId: 'c', amountPaise: 334 },
    ]);
    expect(total(shares)).toBe(1000);
  });

  it('reconciles exactly for awkward amounts and party sizes', () => {
    for (const amount of [1, 7, 101, 99991, 123457]) {
      for (const people of [1, 3, 7, 11]) {
        const base = Math.floor(10000 / people);
        const allocations = Array.from({ length: people }, (_, i) => ({
          userId: `u${i}`,
          basisPoints: i === 0 ? 10000 - base * (people - 1) : base,
        }));
        const shares = splitByPercentage(amount, allocations);
        expect(total(shares)).toBe(amount);
      }
    }
  });

  it('rejects percentages that do not add up to 100', () => {
    expect(() =>
      splitByPercentage(10000, [
        { userId: 'a', basisPoints: 5000 },
        { userId: 'b', basisPoints: 4000 },
      ])
    ).toThrow(/add up to 100%/i);
  });

  it('rejects negative percentages', () => {
    expect(() =>
      splitByPercentage(10000, [
        { userId: 'a', basisPoints: 11000 },
        { userId: 'b', basisPoints: -1000 },
      ])
    ).toThrow(/cannot be negative/i);
  });
});

describe('computeShares dispatcher', () => {
  it('routes each split type to the right algorithm', () => {
    const equal = computeShares({
      splitType: 'EQUAL',
      totalPaise: 1000,
      participants: [{ userId: 'a' }, { userId: 'b' }],
    });
    expect(equal.map((s) => s.amountPaise)).toEqual([500, 500]);

    const exact = computeShares({
      splitType: 'EXACT',
      totalPaise: 1000,
      participants: [
        { userId: 'a', amountPaise: 700 },
        { userId: 'b', amountPaise: 300 },
      ],
    });
    expect(exact.map((s) => s.amountPaise)).toEqual([700, 300]);

    const percent = computeShares({
      splitType: 'PERCENT',
      totalPaise: 1000,
      participants: [
        { userId: 'a', basisPoints: 2500 },
        { userId: 'b', basisPoints: 7500 },
      ],
    });
    expect(percent.map((s) => s.amountPaise)).toEqual([250, 750]);
  });

  it('rejects an unknown split type', () => {
    expect(() =>
      computeShares({ splitType: 'MAGIC', totalPaise: 100, participants: [{ userId: 'a' }] })
    ).toThrow(/unknown split type/i);
  });
});
