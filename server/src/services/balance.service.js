import { Settlement } from '../models/Settlement.js';
import { computeGroupLedger } from '../../../shared/balance.js';
import { loadExpensesForGroups, listMembers, normaliseSettlement } from './group.service.js';

/**
 * Builds the full balance view for a group.
 *
 * Nothing here is stored. Every number is recomputed from the authoritative
 * expense shares and settlements each time, which means balances can never
 * drift out of sync with the records behind them. For the group sizes this
 * product targets (tens of members, hundreds of expenses) the whole
 * computation is a couple of indexed queries and an O(n) pass.
 */
export async function getGroupBalances(groupId) {
  const [members, expenses, settlementDocs] = await Promise.all([
    listMembers(groupId),
    loadExpensesForGroups(groupId),
    Settlement.find({ group: groupId }).lean(),
  ]);

  const activeMembers = members.filter((m) => m.status === 'active');
  const settlements = settlementDocs.map(normaliseSettlement);

  // Members who were removed but still appear in historic expenses must stay in
  // the ledger, otherwise the balances would not sum to zero.
  const historicIds = new Set();
  for (const e of expenses) {
    historicIds.add(String(e.paidBy));
    for (const s of e.shares) historicIds.add(String(s.userId));
  }
  for (const s of settlements) {
    historicIds.add(String(s.fromUser));
    historicIds.add(String(s.toUser));
  }
  const memberIds = [...new Set([...activeMembers.map((m) => m.userId), ...historicIds])];

  const ledger = computeGroupLedger({ memberIds, expenses, settlements });
  const directory = buildDirectory(members);

  return {
    members: activeMembers,
    netBalances: ledger.netBalances.map((b) => ({
      ...decorate(b.userId, directory),
      amountPaise: b.amountPaise,
    })),
    pairwiseDebts: ledger.pairwiseDebts.map((d) => decorateTransfer(d, directory)),
    simplifiedDebts: ledger.simplifiedDebts.map((d) => decorateTransfer(d, directory)),
    totals: {
      totalExpensePaise: ledger.totalExpensePaise,
      totalSettledPaise: ledger.totalSettledPaise,
      expenseCount: expenses.length,
      settlementCount: settlements.length,
    },
  };
}

function buildDirectory(members) {
  const map = new Map();
  for (const m of members) {
    map.set(m.userId, { name: m.name, email: m.email, avatarColor: m.avatarColor, status: m.status });
  }
  return map;
}

function decorate(userId, directory) {
  const info = directory.get(userId) || {};
  return {
    userId,
    name: info.name || 'Former member',
    email: info.email,
    avatarColor: info.avatarColor || '#64748b',
    status: info.status || 'removed',
  };
}

function decorateTransfer(transfer, directory) {
  return {
    from: decorate(transfer.from, directory),
    to: decorate(transfer.to, directory),
    amountPaise: transfer.amountPaise,
  };
}
