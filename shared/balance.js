/**
 * Group accounting: net balances, who-owes-whom, and debt simplification.
 *
 * THE MODEL (one sentence): a member's net balance is everything they paid
 * out, minus everything they were assigned a share of, plus settlements they
 * have paid, minus settlements they have received.
 *
 *     net(u) = SUM expense.amount where u paid
 *            - SUM share.amount assigned to u
 *            + SUM settlement.amount where u is the payer
 *            - SUM settlement.amount where u is the receiver
 *
 * net > 0  -> the group owes this member money (a creditor).
 * net < 0  -> this member owes the group money (a debtor).
 * The sum of all net balances is always exactly 0, because every expense adds
 * its total once and subtracts it once, and every settlement is a pure transfer.
 *
 * Three things are deliberately distinct:
 *   EXPENSE    - money actually spent on behalf of the group. Changes balances.
 *   DEBT       - a derived, outstanding obligation. Never stored; always computed.
 *   SETTLEMENT - a record that one member reimbursed another. Changes balances,
 *                and is NOT spending: it never appears in group expense totals.
 */
import { assertPaise } from './money.js';

const key = (id) => String(id);

/**
 * @param {object} input
 * @param {Array<string>} input.memberIds        every member, so inactive ones still show zero
 * @param {Array<object>} input.expenses         [{ paidBy, shares: [{ userId, amountPaise }] }]
 * @param {Array<object>} input.settlements      [{ fromUser, toUser, amountPaise }]
 * @returns {Map<string, number>} userId -> net balance in paise
 */
export function computeNetBalances({ memberIds = [], expenses = [], settlements = [] }) {
  const net = new Map();
  const bump = (id, delta) => net.set(key(id), (net.get(key(id)) || 0) + delta);

  for (const id of memberIds) net.set(key(id), 0);

  for (const expense of expenses) {
    for (const share of expense.shares || []) {
      assertPaise(share.amountPaise, 'share');
      bump(share.userId, -share.amountPaise);
    }
    // The payer is credited with exactly what the shares add up to, which the
    // split layer guarantees equals the expense total. Crediting the sum of the
    // shares (rather than a separately stored total) makes it impossible for a
    // stale total field to unbalance the group.
    const paid = (expense.shares || []).reduce((acc, s) => acc + s.amountPaise, 0);
    bump(expense.paidBy, paid);
  }

  for (const s of settlements) {
    assertPaise(s.amountPaise, 'settlement');
    bump(s.fromUser, s.amountPaise);
    bump(s.toUser, -s.amountPaise);
  }

  return net;
}

/**
 * Direct, un-simplified obligations: for each expense, every participant other
 * than the payer owes the payer their own share. Settlements are then applied
 * to the specific pair they were recorded against, and finally each pair is
 * netted (if A owes B 100 and B owes A 30, the result is A owes B 70).
 *
 * This answers "who owes whom" truthfully, including the case where two people
 * owe each other through different expenses.
 *
 * @returns {Array<{from: string, to: string, amountPaise: number}>} amounts > 0
 */
export function computePairwiseDebts({ expenses = [], settlements = [] }) {
  /** pairKey -> paise owed by the lexicographically smaller id to the larger */
  const ledger = new Map();
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const record = (debtor, creditor, amountPaise) => {
    const d = key(debtor);
    const c = key(creditor);
    if (d === c || amountPaise === 0) return;
    const k = pairKey(d, c);
    const signed = d < c ? amountPaise : -amountPaise;
    ledger.set(k, (ledger.get(k) || 0) + signed);
  };

  for (const expense of expenses) {
    for (const share of expense.shares || []) {
      record(share.userId, expense.paidBy, share.amountPaise);
    }
  }
  // A settlement from X to Y reduces what X owes Y (or increases what Y owes X
  // if X over-paid, which is why the ledger carries a sign).
  for (const s of settlements) {
    record(s.toUser, s.fromUser, s.amountPaise);
  }

  const debts = [];
  for (const [k, signed] of ledger.entries()) {
    if (signed === 0) continue;
    const [small, large] = k.split('|');
    debts.push(
      signed > 0
        ? { from: small, to: large, amountPaise: signed }
        : { from: large, to: small, amountPaise: -signed }
    );
  }
  return sortTransfers(debts);
}

function sortTransfers(transfers) {
  return transfers.sort(
    (a, b) =>
      b.amountPaise - a.amountPaise || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
  );
}

/**
 * DEBT SIMPLIFICATION - greedy largest-debtor / largest-creditor matching.
 *
 * Take the net balance of every member. Repeatedly pair the member with the
 * largest debt against the member owed the most, transfer the smaller of the
 * two magnitudes, and remove whoever hits zero. Each step zeroes at least one
 * member, so with `n` members carrying a non-zero balance the result is at most
 * `n - 1` transfers - usually far fewer than the raw pairwise list.
 *
 * Determinism: balances are sorted by amount, then by user id, so the same
 * balances always produce the same instructions.
 *
 * LIMITATIONS (also stated in the README):
 *  - It is a greedy heuristic, not a proven minimum. Finding the true minimum
 *    number of transfers is NP-hard (it reduces to subset-sum partitioning).
 *    In practice greedy matching is optimal or within one transfer for the
 *    group sizes this product targets.
 *  - It discards the *history* of who the money was spent with: it may tell A
 *    to pay C even though A never shared an expense with C. The raw pairwise
 *    view is kept alongside it for exactly that reason.
 *  - Totals are preserved exactly: the transfers always re-zero every balance.
 */
export function simplifyDebts(netBalances) {
  const entries = (
    netBalances instanceof Map ? [...netBalances.entries()] : Object.entries(netBalances)
  )
    .map(([userId, amountPaise]) => ({ userId: key(userId), amountPaise: assertPaise(amountPaise) }))
    .filter((e) => e.amountPaise !== 0);

  const debtors = entries
    .filter((e) => e.amountPaise < 0)
    .map((e) => ({ userId: e.userId, remaining: -e.amountPaise }))
    .sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));

  const creditors = entries
    .filter((e) => e.amountPaise > 0)
    .map((e) => ({ userId: e.userId, remaining: e.amountPaise }))
    .sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amountPaise = Math.min(debtor.remaining, creditor.remaining);
    if (amountPaise > 0) {
      transfers.push({ from: debtor.userId, to: creditor.userId, amountPaise });
      debtor.remaining -= amountPaise;
      creditor.remaining -= amountPaise;
    }
    if (debtor.remaining === 0) i += 1;
    if (creditor.remaining === 0) j += 1;
  }
  return sortTransfers(transfers);
}

/**
 * Everything a group balances screen needs, computed in one pass.
 */
export function computeGroupLedger({ memberIds = [], expenses = [], settlements = [] }) {
  const net = computeNetBalances({ memberIds, expenses, settlements });
  return {
    netBalances: [...net.entries()]
      .map(([userId, amountPaise]) => ({ userId, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise || a.userId.localeCompare(b.userId)),
    pairwiseDebts: computePairwiseDebts({ expenses, settlements }),
    simplifiedDebts: simplifyDebts(net),
    totalExpensePaise: expenses.reduce(
      (acc, e) => acc + (e.shares || []).reduce((s, sh) => s + sh.amountPaise, 0),
      0
    ),
    totalSettledPaise: settlements.reduce((acc, s) => acc + s.amountPaise, 0),
  };
}

/**
 * The single number shown on a user's home screen: across every group, how much
 * are they owed and how much do they owe.
 */
export function summariseUserBalances(netBalancePaiseList) {
  let owed = 0;
  let owes = 0;
  for (const amount of netBalancePaiseList) {
    if (amount > 0) owed += amount;
    else owes += -amount;
  }
  return { owedToUserPaise: owed, userOwesPaise: owes, netPaise: owed - owes };
}
