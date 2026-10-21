/**
 * DEVELOPMENT-ONLY seed script.
 *
 * Wipes the target database and fills it with entirely fictional data so the
 * app can be explored without clicking through dozens of forms. It refuses to
 * run against NODE_ENV=production, and every name, email and amount here is
 * invented - no real personal information is ever seeded.
 *
 * The seeding itself lives here as `seedDemoData()` so both the CLI wrapper
 * (seed.js) and the in-memory dev runner (devWithMemoryDb.js) can call it.
 */
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { PersonalTransaction } from '../models/PersonalTransaction.js';
import { Budget } from '../models/Budget.js';
import { Group } from '../models/Group.js';
import { GroupMembership } from '../models/GroupMembership.js';
import { GroupExpense } from '../models/GroupExpense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Settlement } from '../models/Settlement.js';
import { Invitation } from '../models/Invitation.js';
import { toPaise } from '../../../shared/money.js';
import { computeShares } from '../../../shared/split.js';

const PEOPLE = [
  { name: 'Aarav Sharma', email: 'aarav@splitmate.test', avatarColor: '#10b981' },
  { name: 'Diya Nair', email: 'diya@splitmate.test', avatarColor: '#0ea5e9' },
  { name: 'Kabir Mehta', email: 'kabir@splitmate.test', avatarColor: '#8b5cf6' },
  { name: 'Ishita Rao', email: 'ishita@splitmate.test', avatarColor: '#f59e0b' },
];

/** A date `daysAgo` days before today, at UTC midnight. */
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

const PERSONAL = [
  ['income', '72000', 'salary', 'Monthly salary', 'netbanking', 28],
  ['income', '8500', 'freelance', 'Logo design project', 'upi', 21],
  ['expense', '18000', 'rent', 'Flat rent', 'netbanking', 27],
  ['expense', '2450.75', 'groceries', 'Weekly groceries', 'card', 25],
  ['expense', '640', 'food', 'Team lunch', 'upi', 24],
  ['expense', '1299', 'bills', 'Broadband', 'upi', 22],
  ['expense', '320.50', 'transportation', 'Auto rides', 'cash', 20],
  ['expense', '3499', 'shopping', 'Running shoes', 'card', 18],
  ['expense', '899', 'entertainment', 'Cinema tickets', 'upi', 15],
  ['expense', '1150', 'healthcare', 'Pharmacy', 'card', 12],
  ['expense', '2100.25', 'groceries', 'Monthly stock-up', 'card', 10],
  ['expense', '560', 'food', 'Weekend brunch', 'upi', 7],
  ['expense', '4500', 'education', 'Online course', 'card', 5],
  ['expense', '210', 'transportation', 'Metro top-up', 'upi', 3],
  ['expense', '780.40', 'food', 'Dinner with friends', 'upi', 1],
];

const BUDGETS = [
  ['food', '4000'],
  ['groceries', '6000'],
  ['transportation', '2000'],
  ['entertainment', '2500'],
  ['shopping', '5000'],
];

async function wipe() {
  await Promise.all(
    [User, PersonalTransaction, Budget, Group, GroupMembership, GroupExpense, ExpenseShare, Settlement, Invitation].map(
      (model) => model.deleteMany({})
    )
  );
}

/** Writes an expense and its shares, using the same split rules as the API. */
async function addGroupExpense(group, { description, amount, category, paidBy, participants, splitType = 'EQUAL', dayOffset }) {
  const totalPaise = toPaise(amount);
  const prepared = [...participants].sort((a, b) => String(a.userId).localeCompare(String(b.userId)));
  const shares = computeShares({ splitType, totalPaise, participants: prepared });

  const expense = await GroupExpense.create({
    group: group._id,
    description,
    amountPaise: totalPaise,
    category,
    date: daysAgo(dayOffset),
    paidBy,
    splitType,
    createdBy: paidBy,
    updatedBy: paidBy,
  });

  await ExpenseShare.insertMany(
    shares.map((s) => ({
      expense: expense._id,
      group: group._id,
      user: s.userId,
      amountPaise: s.amountPaise,
      basisPoints: splitType === 'PERCENT' ? prepared.find((p) => p.userId === s.userId).basisPoints : null,
    }))
  );
  return expense;
}

/**
 * Wipes the database and inserts the demo data set.
 * @param {object} [options]
 * @param {boolean} [options.connect] open a connection first (the CLI needs this)
 */
export async function seedDemoData({ connect = false } = {}) {
  if (config.isProduction) {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }
  if (connect && mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
  console.log(`Seeding ${mongoose.connection.name} ...`);
  await wipe();

  const passwordHash = await User.hashPassword(config.seedPassword);
  const users = await User.insertMany(PEOPLE.map((p) => ({ ...p, passwordHash })));
  const [aarav, diya, kabir, ishita] = users;

  // --- Personal ledger for the primary demo account -----------------------
  await PersonalTransaction.insertMany(
    PERSONAL.map(([type, amount, category, description, paymentMethod, dayOffset]) => ({
      user: aarav._id,
      type,
      amountPaise: toPaise(amount),
      category,
      description,
      paymentMethod,
      date: daysAgo(dayOffset),
    }))
  );

  const now = new Date();
  await Budget.insertMany(
    BUDGETS.map(([category, limit]) => ({
      user: aarav._id,
      category,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      limitPaise: toPaise(limit),
    }))
  );

  // --- Group 1: a trip, with a mixture of split types ---------------------
  const trip = await Group.create({
    name: 'Goa Trip 2026',
    description: 'Four days, one shared wallet.',
    type: 'trip',
    accentColor: '#10b981',
    createdBy: aarav._id,
  });
  await GroupMembership.insertMany([
    { group: trip._id, user: aarav._id, role: 'owner' },
    { group: trip._id, user: diya._id, role: 'admin' },
    { group: trip._id, user: kabir._id, role: 'member' },
    { group: trip._id, user: ishita._id, role: 'member' },
  ]);

  const everyone = [aarav, diya, kabir, ishita].map((u) => ({ userId: u._id.toString() }));

  await addGroupExpense(trip, {
    description: 'Beach house booking',
    amount: '24000',
    category: 'travel',
    paidBy: aarav._id,
    participants: everyone,
    dayOffset: 20,
  });
  await addGroupExpense(trip, {
    description: 'Flights',
    amount: '31500',
    category: 'travel',
    paidBy: diya._id,
    participants: everyone,
    dayOffset: 19,
  });
  await addGroupExpense(trip, {
    description: 'Seafood dinner',
    amount: '4850.50',
    category: 'food',
    paidBy: kabir._id,
    participants: everyone,
    dayOffset: 17,
  });
  // An uneven amount over three people: the leftover paise is handed out
  // deterministically by the equal-split rule.
  await addGroupExpense(trip, {
    description: 'Scooter rental',
    amount: '1000',
    category: 'transportation',
    paidBy: ishita._id,
    participants: everyone.slice(0, 3),
    dayOffset: 16,
  });
  // A percentage split: Aarav took the big room.
  await addGroupExpense(trip, {
    description: 'Room upgrade',
    amount: '6000',
    category: 'travel',
    splitType: 'PERCENT',
    paidBy: aarav._id,
    participants: [
      { userId: aarav._id.toString(), basisPoints: 5000 },
      { userId: diya._id.toString(), basisPoints: 2500 },
      { userId: kabir._id.toString(), basisPoints: 2500 },
    ],
    dayOffset: 15,
  });

  await Settlement.create({
    group: trip._id,
    fromUser: kabir._id,
    toUser: aarav._id,
    amountPaise: toPaise('5000'),
    method: 'upi',
    note: 'Part payment for the house',
    settledAt: daysAgo(8),
    recordedBy: kabir._id,
  });

  // --- Group 2: a flatshare, with exact splits ---------------------------
  const flat = await Group.create({
    name: 'Flat 3B',
    description: 'Monthly household costs.',
    type: 'roommates',
    accentColor: '#0ea5e9',
    createdBy: diya._id,
  });
  await GroupMembership.insertMany([
    { group: flat._id, user: diya._id, role: 'owner' },
    { group: flat._id, user: aarav._id, role: 'member' },
    { group: flat._id, user: kabir._id, role: 'member' },
  ]);

  await addGroupExpense(flat, {
    description: 'Electricity bill',
    amount: '3420',
    category: 'bills',
    paidBy: diya._id,
    participants: [aarav, diya, kabir].map((u) => ({ userId: u._id.toString() })),
    dayOffset: 12,
  });
  await addGroupExpense(flat, {
    description: 'Groceries run',
    amount: '5200.75',
    category: 'groceries',
    splitType: 'EXACT',
    paidBy: aarav._id,
    participants: [
      { userId: aarav._id.toString(), amountPaise: toPaise('2000.75') },
      { userId: diya._id.toString(), amountPaise: toPaise('1800') },
      { userId: kabir._id.toString(), amountPaise: toPaise('1400') },
    ],
    dayOffset: 6,
  });

  // A pending invitation, to show the invite flow without sending email.
  await Invitation.create({
    group: flat._id,
    email: 'ishita@splitmate.test',
    invitedBy: diya._id,
    token: Invitation.generateToken(),
  });

  console.log('\nSeed complete. Sign in with any of these accounts:');
  for (const p of PEOPLE) console.log(`  ${p.email}  /  ${config.seedPassword}`);
  console.log('\nGroups: "Goa Trip 2026" (4 members), "Flat 3B" (3 members).');
  console.log('All data is fictional.\n');
}
