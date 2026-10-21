/**
 * Expense allocation ("splitting") rules.
 *
 * Every function here takes and returns INTEGER PAISE and guarantees the
 * central invariant of the whole product:
 *
 *     sum(shares) === totalPaise      (exactly, always)
 *
 * Allocation is deterministic: the same inputs in the same participant order
 * always produce the same shares, so recomputing an expense never shifts a
 * paise between members.
 */
import { assertPaise, MoneyError } from './money.js';

export const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENT'];

/** Percentages are carried as integer BASIS POINTS (1% = 100 bp) so they never float. */
export const BASIS_POINTS_TOTAL = 10000;

/** Convert a percentage a user typed ("33.33", 25) into integer basis points. */
export function percentToBasisPoints(percent) {
  const n = typeof percent === 'string' ? Number(percent.trim()) : percent;
  if (!Number.isFinite(n)) throw new MoneyError(`percentage is not a valid number: ${percent}`);
  const bp = Math.round(n * 100);
  if (!Number.isSafeInteger(bp)) throw new MoneyError('percentage is out of range');
  return bp;
}

export function basisPointsToPercent(bp) {
  return bp / 100;
}

function requireParticipants(participantIds) {
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new MoneyError('an expense needs at least one participant');
  }
  const seen = new Set();
  for (const id of participantIds) {
    const key = String(id);
    if (seen.has(key)) throw new MoneyError(`duplicate participant in split: ${key}`);
    seen.add(key);
  }
  return participantIds.map(String);
}

function requirePositiveTotal(totalPaise) {
  assertPaise(totalPaise, 'total');
  if (totalPaise <= 0) throw new MoneyError('expense total must be greater than zero');
  return totalPaise;
}

/**
 * EQUAL split.
 *
 * Indivisible-paise rule: everyone gets floor(total / n). The leftover
 * `total mod n` paise (always < n, so at most 1 paise each) are handed out
 * one at a time to the FIRST participants in the given order. The caller
 * passes participants in a stable order (we sort by id in the service layer),
 * so the same expense always allocates the stray paise to the same people.
 *
 * Example: ₹10.00 across 3 -> 334, 333, 333 paise.
 */
export function splitEqually(totalPaise, participantIds) {
  const ids = requireParticipants(participantIds);
  requirePositiveTotal(totalPaise);
  const n = ids.length;
  const base = Math.floor(totalPaise / n);
  let remainder = totalPaise - base * n;
  return ids.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId, amountPaise: base + extra };
  });
}

/**
 * EXACT split: the caller states every share. We only validate.
 * `amounts` is an array of { userId, amountPaise } in any order.
 */
export function splitExactly(totalPaise, amounts) {
  requirePositiveTotal(totalPaise);
  if (!Array.isArray(amounts) || amounts.length === 0) {
    throw new MoneyError('an expense needs at least one participant');
  }
  requireParticipants(amounts.map((a) => a.userId));
  let sum = 0;
  for (const { userId, amountPaise } of amounts) {
    assertPaise(amountPaise, `share for ${userId}`);
    if (amountPaise < 0) throw new MoneyError('a share cannot be negative');
    sum += amountPaise;
  }
  if (sum !== totalPaise) {
    throw new MoneyError(
      `shares must add up to the expense total: shares are ${sum} paise, total is ${totalPaise} paise`
    );
  }
  return amounts.map(({ userId, amountPaise }) => ({ userId: String(userId), amountPaise }));
}

/**
 * PERCENT split using the largest-remainder (Hamilton) method.
 *
 * Each participant's ideal share is total * bp / 10000, which is rarely a whole
 * paise. We floor every share, then give the leftover paise to the participants
 * with the largest discarded fraction (ties broken by position in the input
 * array). This keeps every share within one paise of its ideal value AND makes
 * the shares sum to the total exactly.
 *
 * `allocations` is an array of { userId, basisPoints }, summing to 10000.
 */
export function splitByPercentage(totalPaise, allocations) {
  requirePositiveTotal(totalPaise);
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new MoneyError('an expense needs at least one participant');
  }
  requireParticipants(allocations.map((a) => a.userId));

  let bpSum = 0;
  for (const { userId, basisPoints } of allocations) {
    if (!Number.isSafeInteger(basisPoints)) {
      throw new MoneyError(`percentage for ${userId} must be a whole number of basis points`);
    }
    if (basisPoints < 0) throw new MoneyError('a percentage cannot be negative');
    bpSum += basisPoints;
  }
  if (bpSum !== BASIS_POINTS_TOTAL) {
    throw new MoneyError(
      `percentages must add up to 100%: received ${(bpSum / 100).toFixed(2)}%`
    );
  }

  const scaled = allocations.map(({ userId, basisPoints }, index) => {
    const exact = totalPaise * basisPoints; // integer, divided below
    const floored = Math.floor(exact / BASIS_POINTS_TOTAL);
    return {
      userId: String(userId),
      index,
      amountPaise: floored,
      remainder: exact - floored * BASIS_POINTS_TOTAL,
    };
  });

  let leftover = totalPaise - scaled.reduce((acc, s) => acc + s.amountPaise, 0);
  const order = [...scaled].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < order.length && leftover > 0; i += 1) {
    order[i].amountPaise += 1;
    leftover -= 1;
  }

  return scaled.map(({ userId, amountPaise }) => ({ userId, amountPaise }));
}

/**
 * Single entry point used by the API and by the client's live preview.
 *
 * input = {
 *   splitType: 'EQUAL' | 'EXACT' | 'PERCENT',
 *   totalPaise: integer,
 *   participants: [{ userId, amountPaise?, basisPoints? }]
 * }
 * -> [{ userId, amountPaise }] summing exactly to totalPaise.
 */
export function computeShares({ splitType, totalPaise, participants }) {
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new MoneyError(`unknown split type: ${splitType}`);
  }
  switch (splitType) {
    case 'EQUAL':
      return splitEqually(totalPaise, participants.map((p) => p.userId));
    case 'EXACT':
      return splitExactly(
        totalPaise,
        participants.map((p) => ({ userId: p.userId, amountPaise: p.amountPaise }))
      );
    case 'PERCENT':
      return splitByPercentage(
        totalPaise,
        participants.map((p) => ({ userId: p.userId, basisPoints: p.basisPoints }))
      );
    default:
      throw new MoneyError(`unknown split type: ${splitType}`);
  }
}
