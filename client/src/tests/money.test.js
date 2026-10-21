import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatSigned,
  formatCompact,
  formatBasisPoints,
  toChartValue,
  toPaise,
  paiseToInputString,
} from '../utils/money.js';

/**
 * The client re-exports the shared money rules rather than reimplementing
 * them. These tests pin the display helpers that only exist on this side.
 */
describe('client money formatting', () => {
  it('re-exports the shared parser, so client and server agree exactly', () => {
    expect(toPaise('1,250.50')).toBe(125050);
    expect(paiseToInputString(125050)).toBe('1250.50');
  });

  it('formats rupees for display', () => {
    expect(formatMoney(125050)).toBe('₹1,250.50');
  });

  it('always shows a sign when direction matters', () => {
    expect(formatSigned(5000)).toBe('+₹50.00');
    expect(formatSigned(-5000)).toBe('-₹50.00');
  });

  it('compacts large amounts into Indian units', () => {
    expect(formatCompact(500000)).toBe('₹5.0K');
    expect(formatCompact(12345678)).toBe('₹1.23L');
    // 1234567890 paise = Rs 1,23,45,678.90 = 1.23 crore.
    expect(formatCompact(1234567890)).toBe('₹1.23Cr');
    expect(formatCompact(45000)).toBe('₹450.00');
  });

  it('renders basis points as a percentage', () => {
    expect(formatBasisPoints(2500)).toBe('25%');
    expect(formatBasisPoints(3333)).toBe('33.33%');
  });

  it('converts paise to plain rupee numbers for charts only', () => {
    expect(toChartValue(125050)).toBe(1250.5);
  });
});
