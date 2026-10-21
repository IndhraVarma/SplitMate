import { describe, it, expect } from 'vitest';
import { toPaise, fromPaise, formatMoney, sumPaise, MoneyError } from '../../../shared/money.js';

describe('money: parsing rupees into integer paise', () => {
  it('parses plain numbers and numeric strings identically', () => {
    expect(toPaise(1250.5)).toBe(125050);
    expect(toPaise('1250.50')).toBe(125050);
    expect(toPaise('1,250.50')).toBe(125050);
    expect(toPaise('\u20B91,250.50')).toBe(125050);
    expect(toPaise('1250')).toBe(125000);
  });

  it('rounds to the nearest paise, away from zero on a tie', () => {
    expect(toPaise(0.005)).toBe(1);
    expect(toPaise(0.004)).toBe(0);
    expect(toPaise(-0.005)).toBe(-1);
    expect(toPaise(10.555)).toBe(1056);
  });

  it('is exact where floating point is not', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; in paise it is just 10 + 20 === 30.
    expect(toPaise(0.1) + toPaise(0.2)).toBe(toPaise(0.3));
    expect(sumPaise([toPaise(0.1), toPaise(0.2)])).toBe(30);
  });

  it('rejects values that are not numbers', () => {
    expect(() => toPaise('abc')).toThrow(MoneyError);
    expect(() => toPaise('')).toThrow(MoneyError);
    expect(() => toPaise(null)).toThrow(MoneyError);
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
    expect(() => toPaise({})).toThrow(MoneyError);
  });

  it('round-trips back to rupees', () => {
    expect(fromPaise(125050)).toBe(1250.5);
    expect(fromPaise(0)).toBe(0);
  });
});

describe('money: formatting', () => {
  it('formats paise as Indian rupees', () => {
    expect(formatMoney(123456)).toBe('\u20B91,234.56');
    expect(formatMoney(0)).toBe('\u20B90.00');
  });

  it('can hide decimals on whole-rupee amounts only', () => {
    expect(formatMoney(100000, { hideDecimals: true })).toBe('\u20B91,000');
    expect(formatMoney(100050, { hideDecimals: true })).toBe('\u20B91,000.50');
  });

  it('refuses to format a non-integer, which would mean a float leaked in', () => {
    expect(() => formatMoney(12.5)).toThrow(MoneyError);
  });
});
