# SplitMate

**A mobile-first personal expense tracker and group money splitter, built with the MERN stack.**

SplitMate does two connected jobs: it tracks what *you* spend, and it settles the
awkward question of who owes whom after a trip, a flatshare or a night out — down
to the last paise.

| | |
| --- | --- |
| **Live demo** | `<!-- TODO: paste your Vercel URL, e.g. https://splitmate.vercel.app -->` |
| **Live API** | `<!-- TODO: paste your Render URL, e.g. https://splitmate-api.onrender.com/api/health -->` |
| **Repository** | `<!-- TODO: paste your GitHub URL -->` |
| **Demo login** | Seed the database (see [Seeding demo data](#seeding-demo-data)), then sign in as `aarav@splitmate.test` / `Password123!` |

> **Screenshots** — add yours here once deployed.
>
> | Dashboard | Group balances | Add shared expense |
> | --- | --- | --- |
> | `<!-- ![Dashboard](docs/screenshots/dashboard.png) -->` | `<!-- ![Balances](docs/screenshots/balances.png) -->` | `<!-- ![Split](docs/screenshots/split.png) -->` |

---

## Table of contents

1. [What it does](#what-it-does)
2. [How the money maths works](#how-the-money-maths-works)
3. [Design language](#design-language)
4. [Tech stack](#tech-stack)
5. [Architecture and folder structure](#architecture-and-folder-structure)
6. [Prerequisites](#prerequisites)
7. [Getting it running locally](#getting-it-running-locally)
8. [Environment variables](#environment-variables)
9. [Seeding demo data](#seeding-demo-data)
10. [Running the tests](#running-the-tests)
11. [Deploying the backend to Render](#deploying-the-backend-to-render)
12. [Deploying the frontend to Vercel](#deploying-the-frontend-to-vercel)
13. [Production CORS](#production-cors)
14. [Testing the deployed app](#testing-the-deployed-app)
15. [Security notes](#security-notes)
16. [Troubleshooting](#troubleshooting)
17. [What is implemented, and what is not](#what-is-implemented-and-what-is-not)
18. [Resume description](#resume-description)
19. [Suggested commit messages](#suggested-commit-messages)

---

## What it does

### Personal expense tracker

- Register, sign in, sign out; update your profile and change your password.
- Dashboard with income, spending, period balance and spending trends.
- Add, view, edit and delete income and expense transactions.
- Categories for expenses (food, groceries, transport, shopping, rent, bills,
  entertainment, healthcare, education, travel, other) and for income (salary,
  business, freelance, investment, gift, refund, other).
- Amount, date, category, description, payment method and notes on every entry.
- Filter by date range, category, type and free-text search; paginated lists.
- Monthly and yearly summaries; daily, monthly and per-category analytics.
- Interactive charts (donut by category, bars by month, area by day).
- Monthly budgets per category, with real spending measured against them.
- Recent-activity feed, skeleton loaders and purposeful empty states throughout.

### Group money splitter

- Create groups for trips, roommates, friends, events or households.
- Add members who already have an account, or create an invite code for an email.
- Group detail with expenses, balances, settlement history and member management.
- Add a shared expense with description, total, date, category, payer and
  participants.
- **Equal**, **exact-amount** and **percentage** splits, with a live preview that
  uses the exact same code the server does.
- Allocations are validated to reconcile to the total, to the paise.
- Edit or delete an expense; balances recalculate immediately.
- Net balance per member; who owes whom; simplified repayments.
- Record full **or partial** settlements, with duplicate-submission protection.
- Settlement history, filterable by person.
- Non-members cannot see or touch anything in a group.

---

## How the money maths works

This is the part worth reading, and the part the tests concentrate on.

### Everything is integer paise

`0.1 + 0.2 !== 0.3` in IEEE-754 floating point. A ledger built on floats silently
drifts. So **every monetary value in the database, the API and the shared helpers
is an integer number of paise** (1 rupee = 100 paise). Floats appear in exactly two
places: parsing what a user typed, and formatting a string for the screen.

Fields are named accordingly: `amountPaise`, `limitPaise`, `totalExpensePaise`.
Requests accept a friendly rupee value (`"1,250.50"`) and convert once, on entry.

### One shared implementation, used by both sides

The financial rules live in [`shared/`](shared/) at the repository root and are
imported by **both** the Express API and the React client:

| File | Responsibility |
| --- | --- |
| [`shared/money.js`](shared/money.js) | Parsing, rounding, formatting, the paise invariant |
| [`shared/split.js`](shared/split.js) | Equal / exact / percentage allocation |
| [`shared/balance.js`](shared/balance.js) | Net balances, who-owes-whom, debt simplification |

The client's split preview is not a reimplementation — it calls `computeShares()`,
the very function the server calls. What you see before saving is exactly what gets
stored, including which person receives a stray paise.

*(This is why both deployments build from the repository root rather than from
`client/` or `server/` — see the deployment sections.)*

### Indivisible paise

**Equal splits.** Everyone gets `floor(total / n)`. The `total mod n` leftover paise
(always fewer than `n`, so at most one each) go one at a time to the first
participants **in user-id order**. Participants are sorted before allocation, so
the same expense always allocates the stray paise to the same people — editing an
expense never shuffles a paise between members.

> ₹10.00 across three people → `334, 333, 333` paise. Sum: exactly 1000.

**Percentage splits** use the largest-remainder (Hamilton) method: floor every
share, then hand the leftover paise to the participants with the largest discarded
fraction, ties broken by input order. Every share stays within one paise of its
ideal value *and* the shares sum exactly to the total.

**Exact splits** are validated, not computed: if the amounts do not sum to the
total, the request is rejected with a message saying by how much.

### The group accounting model

Three things are kept strictly distinct:

| | Meaning | Affects balances? | Counts as group spending? |
| --- | --- | --- | --- |
| **Expense** | Money actually spent on the group's behalf | Yes | Yes |
| **Debt** | A derived, outstanding obligation | — (never stored) | No |
| **Settlement** | A record that one member repaid another | Yes | **No** |

A member's net balance is:

```
net(u) =  Σ expense totals where u paid
        − Σ share amounts assigned to u
        + Σ settlements u paid
        − Σ settlements u received
```

- `net > 0` → the group owes them (a creditor).
- `net < 0` → they owe the group (a debtor).
- **The net balances of a group always sum to exactly zero.** Several tests assert
  this after awkward amounts, partial settlements and member removals.

Balances are **never cached**. They are recomputed from the stored expense shares
and settlements on every request, so they cannot drift out of step with the records
behind them. The payer is credited with the *sum of the shares* rather than a
separately stored total, which makes it impossible for a stale total field to
unbalance a group.

### Personal balance

For the personal tracker, `balance = income − expenses` **within the selected
window**. It is a cash-flow figure for that period, not a running net worth.

Group expenses and settlements are deliberately **excluded** from the personal
ledger: fronting ₹4,000 for a group dinner is not ₹4,000 of personal spending, and
being repaid is not income. If you want a group cost in your personal ledger, you
add it explicitly.

### Debt simplification, and its limits

`simplifyDebts()` repeatedly matches the largest debtor against the largest
creditor and transfers the smaller of the two magnitudes. Each step zeroes at least
one person, so `n` members with a non-zero balance need at most `n − 1` transfers —
usually far fewer than the raw pairwise list. It is deterministic: the same
balances always produce the same instructions.

**Limitations, stated honestly:**

- It is a **greedy heuristic, not a proven minimum**. Finding the true minimum
  number of transfers is NP-hard (it reduces to subset-sum partitioning). For the
  group sizes this product targets it is optimal or within one transfer.
- It **discards the history** of who spent money with whom. It may tell A to pay C
  even though they never shared an expense. That is why the raw pairwise view is
  kept alongside it under the "Who owes whom" tab.
- Totals are always preserved exactly — applying the transfers re-zeroes every
  balance. There is a test that asserts precisely this across several balance sets.

---

## Design language

A light, friendly **sage-and-olive** palette rather than a dark one: pale green
canvases, deep olive for anything actionable, and near-black text. Only one
saturated colour appears on a screen at a time, with a red/green pair reserved
*exclusively* for money moving out or coming in - so colour always means the same
thing.

- **Sign-in screens** sit on a pale sage canvas with a stacked wordmark and
  underlined, icon-led fields.
- **Home** leads with a search box and olive group tiles showing the bill amount,
  who is in the group, and whether you are settled.
- **Groups** is a dense list: a tinted initials tile, the group name, and a
  subtitle that leads with your own outstanding balance.
- **Recent activity** uses an up arrow for money out and a down arrow for money
  in, with the amount in red or green. The arrow carries a text label for screen
  readers, so direction is never conveyed by colour alone.
- **Splitting an expense** offers a slider per person alongside a typed amount.
  Each slider is capped at whatever the other participants have not claimed, so
  dragging can never overshoot the total - and the reconciliation line underneath
  always states what is allocated versus what is left.
- Navigation is a **hamburger drawer on phones** (focus-trapped, Escape closes,
  focus returns to the trigger) and a **permanent sidebar from `lg` up**.

Every screen is written against semantic tokens (`surface-*`, `ink-*`, `accent`)
defined in [`client/tailwind.config.js`](client/tailwind.config.js), so the whole
theme can be retuned from that one file.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite 6, JavaScript (ES modules) |
| Styling | Tailwind CSS 3 (custom light sage-and-olive palette) |
| Routing | React Router 6, with code-split signed-in routes |
| Charts | Recharts 2 |
| HTTP | Axios, with request/response interceptors |
| Backend | Node.js 22 + Express 4 |
| Database | MongoDB Atlas + Mongoose 8 |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validation | Zod (every request body, query and param) |
| Security | `helmet`, `cors`, `express-rate-limit`, `cookie-parser` |
| Testing | Vitest, Supertest, React Testing Library, `mongodb-memory-server` |
| Hosting | Vercel (frontend), Render (API), MongoDB Atlas (database) |

---

## Architecture and folder structure

```
SplitMate/
├── shared/                     # Financial core — imported by BOTH client and server
│   ├── money.js                #   paise, parsing, rounding, formatting
│   ├── split.js                #   equal / exact / percentage allocation
│   └── balance.js              #   net balances, pairwise debts, simplification
│
├── server/
│   ├── .env.example
│   └── src/
│       ├── config/             # env.js (all config), database.js (connection, retries)
│       ├── models/             # User, PersonalTransaction, Budget, Group,
│       │                       # GroupMembership, GroupExpense, ExpenseShare,
│       │                       # Settlement, Invitation
│       ├── validators/         # Zod schemas, one module per resource
│       ├── middleware/         # authenticate, validate, groupAccess, errorHandler, rateLimit
│       ├── services/           # business logic (auth, transaction, analytics, budget,
│       │                       # group, expense, balance, settlement)
│       ├── controllers/        # thin HTTP adapters over the services
│       ├── routes/             # route tables + health check
│       ├── utils/              # ApiError, asyncHandler, apiResponse, pagination, dates, regex
│       ├── scripts/            # seed.js, seedCore.js, devWithMemoryDb.js
│       ├── tests/              # Vitest + Supertest suites
│       ├── app.js              # builds the Express app (no listener — testable)
│       └── server.js           # connects the DB, then listens; graceful shutdown
│
├── client/
│   ├── .env.example
│   └── src/
│       ├── components/         # ui/ (Button, Card, Field, Modal, …), charts/, transactions/
│       ├── pages/              # one file per screen
│       ├── layouts/            # AppLayout, AuthLayout, GroupLayout, PageHeader
│       ├── hooks/              # useAsync, useDebouncedValue, useIdempotencyKey, …
│       ├── services/           # api.js (axios + interceptors) + one module per resource
│       ├── context/            # AuthContext, ToastContext
│       ├── routes/             # route table + ProtectedRoute / PublicOnlyRoute
│       ├── utils/              # money (re-exports shared), format, constants
│       └── tests/              # Vitest + React Testing Library
│
├── docs/API.md                 # full endpoint reference
├── render.yaml                 # Render blueprint for the API
├── vercel.json                 # Vercel build + SPA rewrite config
└── package.json                # convenience scripts across both workspaces
```

**Design principles in use here**

- Controllers stay thin; all business logic lives in `services/`.
- Financial logic is written once in `shared/` and tested in isolation.
- There is exactly one authorization gate for groups (`middleware/groupAccess.js`),
  mounted on every `/:groupId` route — no controller can forget it.
- Every response goes through one envelope; every error through one handler.
- No component or controller is allowed to grow unbounded; screens compose small
  reusable pieces.

---

## Prerequisites

**Software**

- **Node.js 18.18 or newer** (developed on 22.14). Check with `node -v`.
  Download: <https://nodejs.org>
- **npm 9+** (ships with Node). Check with `npm -v`.
- **Git**. Check with `git --version`.

**Accounts you will need to create yourself** *(all have free tiers)*

| Account | Why | Sign up |
| --- | --- | --- |
| GitHub | Hosting the repository; both deploy platforms read from it | <https://github.com> |
| MongoDB Atlas | The production database | <https://www.mongodb.com/cloud/atlas/register> |
| Render | Hosting the Express API | <https://render.com> |
| Vercel | Hosting the React frontend | <https://vercel.com> |

> 🧑‍💻 **Steps marked "manual" below are things only you can do** — creating
> accounts, generating credentials, pasting secrets into dashboards. Nothing in
> this repository contains or requires a committed secret.

---

## Getting it running locally

### 1. Clone the repository

```bash
git clone <!-- TODO: your repo URL, e.g. https://github.com/yourname/splitmate.git -->
cd splitmate
```

### 2. Install dependencies

From the repository root:

```bash
npm run install:all
```

That runs `npm install` in both `server/` and `client/`. (You can also install them
separately with `npm --prefix server install` and `npm --prefix client install`.)

### 3. Create your environment files

```bash
# macOS / Linux
cp server/.env.example server/.env
cp client/.env.example client/.env

# Windows PowerShell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Now open `server/.env` and set two values:

**`JWT_SECRET`** — generate a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**`MONGODB_URI`** — see the next section.

`client/.env` already points at `http://localhost:5000/api` and needs no change for
local development.

### 4. Set up MongoDB Atlas 🧑‍💻 *(manual)*

1. Sign in at <https://cloud.mongodb.com> and **Create a project** (call it
   `SplitMate`).
2. **Build a Cluster** → choose the **M0 Free** tier → pick the region closest to
   you → **Create Deployment**.
3. Atlas prompts you to create a database user. Choose a username and let it
   generate a password. **Copy the password now** — it is not shown again. If you
   missed it, go to **Database Access → Edit → Edit Password**.
4. Go to **Network Access → Add IP Address**.
   - For local development: **Add Current IP Address**.
   - For Render: Render's free tier has no fixed outbound IP, so you need
     **Allow Access From Anywhere** (`0.0.0.0/0`). Your database is still protected
     by its username and password. Use a strong generated password.
5. Go to **Database → Connect → Drivers** and copy the connection string. It looks
   like:

   ```
   mongodb+srv://<username>:<password>@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority
   ```

6. Edit it before pasting into `server/.env`:
   - Replace `<username>` and `<password>` with your real values.
   - **Insert the database name** `splitmate` between the host and the `?`.
   - If your password contains `@ : / ? # [ ] %`, URL-encode it (`@` → `%40`,
     `#` → `%23`, and so on).

   ```
   MONGODB_URI=mongodb+srv://splitmate_user:YourPassword@cluster0.ab1cd.mongodb.net/splitmate?retryWrites=true&w=majority
   ```

> **No Atlas account yet, and you just want to see the app?** Run
> `npm --prefix server run dev:memory` instead of step 5 below. It starts a
> throw-away in-memory MongoDB, seeds it with demo data and runs the API — no
> account, no connection string. Nothing is persisted. It is a development
> convenience only; production always reads `MONGODB_URI` from the environment.

### 5. Run it

Open **two terminals**, both at the repository root:

```bash
# Terminal 1 — the API on http://localhost:5000
npm run dev:server
```

```bash
# Terminal 2 — the web app on http://localhost:5173
npm run dev:client
```

Open <http://localhost:5173>. Create an account, or seed demo data first (below).

Check the API is healthy: <http://localhost:5000/api/health>

### All available scripts

**Repository root**

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install dependencies for both server and client |
| `npm run dev:server` | Start the API in watch mode (port 5000) |
| `npm run dev:client` | Start the Vite dev server (port 5173) |
| `npm run seed` | Wipe and reseed the database with demo data |
| `npm test` | Run both test suites |
| `npm run test:server` | Run the API tests only |
| `npm run test:client` | Run the frontend tests only |
| `npm run build` | Production build of the frontend into `client/dist` |

**`server/`**

| Command | What it does |
| --- | --- |
| `npm run dev` | `node --watch src/server.js` |
| `npm start` | Production start (used by Render) |
| `npm run dev:memory` | In-memory MongoDB + seed + API, zero setup (dev only) |
| `npm run seed` | Seed the database `MONGODB_URI` points at |
| `npm test` | Vitest + Supertest suite |
| `npm run test:watch` | The same, in watch mode |

**`client/`**

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest + React Testing Library |
| `npm run test:watch` | The same, in watch mode |

---

## Environment variables

### `server/.env`

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string, including the database name. From Atlas → Connect → Drivers. |
| `JWT_SECRET` | **Yes** | — | Signs and verifies JWTs. Must be ≥32 characters in production (the server refuses to boot otherwise). Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `PORT` | No | `5000` | Port to listen on. **Render sets this itself — do not override it there.** |
| `NODE_ENV` | No | `development` | `development`, `production` or `test`. Production hides stack traces and hardens cookies. |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime (`15m`, `2h`, `7d`). |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt cost factor. `12` is a good production value; higher is slower. |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of browser origins allowed to call the API. **No trailing slashes.** Set this to your Vercel URL in production. |
| `SEED_PASSWORD` | No | `Password123!` | Password given to every seeded demo account. Development only. |

### `client/.env`

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | **Yes** in production | `http://localhost:5000/api` | Base URL of the API, **including the `/api` suffix and with no trailing slash**. Vite inlines `VITE_*` variables at build time, so changing it requires a rebuild/redeploy. |

> ⚠️ Anything prefixed `VITE_` is embedded in the JavaScript bundle and is public.
> Never put a secret in `client/.env`.

---

## Seeding demo data

```bash
npm run seed            # from the repository root
# or: npm --prefix server run seed
```

This **deletes every document** in the database `MONGODB_URI` points at, then
inserts a fictional data set:

- Four demo users — `aarav@`, `diya@`, `kabir@`, `ishita@` `splitmate.test`
- Password for all of them: whatever `SEED_PASSWORD` is set to (`Password123!`)
- ~15 personal transactions and 5 budgets for Aarav
- **Goa Trip 2026** — 4 members, 5 expenses using equal and percentage splits, one
  partial settlement
- **Flat 3B** — 3 members, expenses using equal and exact splits, one pending
  invitation

Every name, email and amount is invented. The script refuses to run when
`NODE_ENV=production`. **Never point it at a database with real data.**

---

## Running the tests

```bash
npm test                 # both suites, from the repository root
npm run test:server      # API tests
npm run test:client      # frontend tests
```

The API tests spin up a real **in-memory MongoDB replica set** (via
`mongodb-memory-server`), so transaction code paths are genuinely exercised rather
than skipped. The first run downloads a MongoDB binary (~100 MB) and takes a few
minutes; later runs are fast. No test ever touches your real database.

### What is covered

**Financial core** (`server/src/tests/money|split|balance.test.js`)

- Parsing and rounding rupees into paise; exactness where floats fail
- Equal splits over many amounts and party sizes, asserting the sum is always exact
- Where the indivisible paise goes, and that shares never differ by more than one
- Exact splits: reconciliation, zero shares, negative shares, over/under by a paise
- Percentage splits: largest-remainder allocation, exact reconciliation, bad totals
- Net balances: payer credit, participant debits, always summing to zero
- Settlements: full, partial, over-payment flipping the direction, not counted as spend
- Pairwise debts: netting two people who each owe the other, clearing settled pairs
- Debt simplification: circular debts, transfer-count bound, determinism, and that
  applying the transfers re-zeroes every balance
- Edge cases: one participant, 17 participants, amounts smaller than the party size

**API** (`auth|transactions|analytics|budgets|groups|expenses|settlements.test.js`)

- Registration and login validation; bcrypt hashing; no hash in any response
- Identical responses for unknown email and wrong password (no account enumeration)
- Missing, malformed, forged and expired tokens
- **Access isolation** — one user cannot read or modify another's transactions,
  budgets or groups by changing an id
- Group privacy: non-members get `404`, and cannot read or write anything
- Role checks: a plain member cannot rename or delete a group
- Splits through the full HTTP stack, including awkward amounts
- Expense edits and deletes recalculating balances; rejected writes leaving no trace
- Duplicate settlement submissions, including genuinely concurrent ones
- Member removal refused while a balance is outstanding
- Validation and error-envelope behaviour, malformed JSON, invalid ids

**Frontend** (`client/src/tests/`)

- Sign-in form validation, submission and server-error display
- The shared-expense form's live split preview: equal, exact and percentage,
  including the `334/333/333` paise case and reconciliation failures
- That the form refuses to submit an allocation that does not add up

### Latest local run

```
server:  10 test files, 157 tests passed
client:   3 test files,  22 tests passed
```

---

## Deploying the backend to Render

> 🧑‍💻 Every step here is manual — it needs your accounts and your secrets.

### 1. Push to GitHub

```bash
git init                       # if you have not already
git add .
git commit -m "feat: SplitMate expense tracker and group splitter"
git branch -M main
git remote add origin <!-- TODO: your repo URL -->
git push -u origin main
```

Confirm that `.env` files are **not** in the commit — `.gitignore` excludes them.
Check with `git status --porcelain` and `git ls-files | grep .env` (you should see
only the `.env.example` files).

### 2. Create the Render service

1. Sign in at <https://dashboard.render.com> → **New +** → **Web Service**.
2. Connect your GitHub account and pick the SplitMate repository.
3. Configure it **exactly** like this:

   | Field | Value |
   | --- | --- |
   | **Name** | `splitmate-api` |
   | **Region** | Whichever is closest to your Atlas cluster |
   | **Branch** | `main` |
   | **Root Directory** | **leave blank** |
   | **Runtime** | `Node` |
   | **Build Command** | `npm --prefix server ci --omit=dev` |
   | **Start Command** | `npm --prefix server start` |
   | **Instance Type** | Free |

   > ❗ **Root Directory must stay blank.** The server imports the shared financial
   > core from `/shared`, which sits *outside* `server/`. Pointing Render at
   > `server/` makes the build fail with `Cannot find module '../../shared/money.js'`.
   >
   > `--omit=dev` matters too: it keeps `mongodb-memory-server` (which downloads a
   > MongoDB binary) out of the production build.

4. Set **Health Check Path** to `/api/health` (under Advanced).

### 3. Add the environment variables 🧑‍💻

In the service's **Environment** tab, add:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your Atlas connection string (with the password and `/splitmate`) |
| `JWT_SECRET` | A fresh 64+ character random string — **not** the one from your laptop |
| `JWT_EXPIRES_IN` | `7d` |
| `BCRYPT_SALT_ROUNDS` | `12` |
| `CORS_ORIGINS` | Leave as `http://localhost:5173` for now; you will update it after deploying the frontend |

**Do not set `PORT`.** Render injects it, and the server reads it.

### 4. Deploy and verify

Click **Create Web Service**. The first build takes a few minutes. When it is live:

```bash
curl https://<your-service>.onrender.com/api/health
```

You want `"status":"ok"` **and `"database":"connected"`**. If `database` says
`disconnected`, the Atlas URI or the IP allow-list is wrong — see
[Troubleshooting](#troubleshooting).

> The Render free tier sleeps after 15 minutes of inactivity. The first request
> after that takes 30–60 seconds. This is normal, and worth mentioning if you demo
> the project to someone.

*(The repository also contains [`render.yaml`](render.yaml), so you can instead use
**New + → Blueprint** and let Render read the configuration from it. It will still
prompt you for the two secrets.)*

---

## Deploying the frontend to Vercel

> 🧑‍💻 Manual steps.

1. Sign in at <https://vercel.com> → **Add New… → Project** → import the same
   repository.
2. Configure:

   | Field | Value |
   | --- | --- |
   | **Framework Preset** | `Other` |
   | **Root Directory** | **leave as the repository root** (do *not* select `client`) |
   | **Build Command** | `npm --prefix client run build` |
   | **Output Directory** | `client/dist` |
   | **Install Command** | `npm --prefix client ci` |

   > ❗ Same reason as Render: the client imports `/shared`, which is outside
   > `client/`. [`vercel.json`](vercel.json) at the repository root already
   > declares all of this, so in practice Vercel picks it up automatically — just
   > leave the Root Directory alone.

3. Under **Environment Variables**, add:

   | Key | Value | Environments |
   | --- | --- | --- |
   | `VITE_API_BASE_URL` | `https://<your-service>.onrender.com/api` | Production, Preview, Development |

   Include `/api`. No trailing slash.

4. **Deploy.**

> `VITE_*` variables are baked in at build time. If you change
> `VITE_API_BASE_URL` later you must **redeploy** — Deployments → ⋯ → Redeploy.
> Clearing the browser cache will not help.

`vercel.json` also configures the SPA rewrite, so deep links like
`/app/groups/abc123/balances` resolve to `index.html` instead of 404ing.

---

## Production CORS

The API only accepts browser requests from origins listed in `CORS_ORIGINS`.
After the Vercel deploy finishes:

1. Copy your Vercel production URL, e.g. `https://splitmate.vercel.app`.
2. In Render → your service → **Environment**, set:

   ```
   CORS_ORIGINS=https://splitmate.vercel.app
   ```

3. **Save** — Render redeploys automatically.

Rules:

- **No trailing slash.** `https://splitmate.vercel.app/` will not match.
- Include the scheme (`https://`).
- Multiple origins are comma-separated, no spaces needed:
  `https://splitmate.vercel.app,https://www.yourdomain.com`
- Vercel gives every preview deployment its own URL. To use previews against the
  live API, add those origins too — or point previews at a separate API instance.
- Requests with no `Origin` header (curl, server-to-server, Render's health check)
  are allowed. CORS is a browser protection; such callers are not subject to it.

A rejected origin gets `403` with `{"error":{"code":"CORS_REJECTED"}}`.

---

## Testing the deployed app

**1. The API is alive and connected**

```bash
curl https://<your-service>.onrender.com/api/health
# {"success":true,"data":{"status":"ok","database":"connected",...}}
```

**2. Auth is enforced**

```bash
curl -i https://<your-service>.onrender.com/api/transactions
# HTTP/1.1 401  {"error":{"code":"TOKEN_MISSING",...}}
```

**3. CORS is configured**

```bash
curl -i -H "Origin: https://<your-app>.vercel.app" \
  https://<your-service>.onrender.com/api/health | grep -i access-control-allow-origin
# Access-Control-Allow-Origin: https://<your-app>.vercel.app

curl -i -H "Origin: https://evil.example" \
  https://<your-service>.onrender.com/api/health
# HTTP/1.1 403  CORS_REJECTED
```

**4. Register and sign in**

```bash
curl -X POST https://<your-service>.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password123"}'
```

**5. Walk the app in a browser**

- Open your Vercel URL, register, land on the dashboard.
- Add an income and an expense; check the dashboard figures and charts.
- Set a budget; confirm spending shows against it.
- Create a group, add a second account, add an expense split **3 ways on ₹10** —
  confirm the shares read `₹3.34 / ₹3.33 / ₹3.33`.
- Open **Balances**; confirm the net balances and the simplified transfers.
- Record a **partial** settlement; confirm the remaining balance is right.
- Sign in as the other user and confirm they see the same group but not the first
  user's personal transactions.
- Try opening a group URL while signed in as a third, unrelated account — you
  should get a "does not exist, or you are not a member" message.
- Resize to a phone width (or use a real phone): every flow should work with **no
  horizontal scrolling**.

---

## Security notes

**Passwords.** Hashed with bcrypt (cost 10 locally, 12 recommended in production).
The hash field is `select: false` on the model, so it cannot leak through a
careless `res.json(user)` — there is a test asserting no response ever contains
`passwordHash`.

**Token transport — a deliberate trade-off.** The API sets an `httpOnly`,
`Secure`, `SameSite=None` cookie *and* returns the token in the response body; the
SPA sends it as an `Authorization: Bearer` header. Cookies alone would be cleaner,
but the client (Vercel) and API (Render) are on **different sites**, which makes
the session cookie third-party — blocked by default in Safari and increasingly in
Chrome. The bearer token is stored in `localStorage`, which is readable by any
script that achieves XSS on the page; the mitigation is that the app renders no
user-supplied HTML and ships no third-party scripts. If you later serve both from
one domain (a reverse proxy, or Vercel rewrites), switch to cookie-only and drop
`localStorage` — the server already accepts both.

**Authorization.** Every user-owned query is scoped by the owner's id in the
database filter, so another user's id simply matches nothing and returns `404`
rather than their data. Every group route passes through one membership gate
(`middleware/groupAccess.js`). Non-members get `404`, not `403`, so a stranger
cannot even confirm that a group exists. There are tests for all of this.

**Validation.** Every body, query and path parameter is parsed by a Zod schema.
Schemas are `.strict()`, so unexpected fields are rejected rather than ignored —
that blocks mass-assignment through the request body. Validated values replace the
originals, so controllers only ever see coerced, trusted data.

**Injection.** Mongoose casts every value to its schema type. Free-text search is
escaped before it reaches a `$regex`, so a search for `.*` matches the literal
characters rather than everything.

**Rate limiting.** Login and password change: 10 per 15 minutes. Registration: 20
per hour. Everything else: 600 per 15 minutes.

**Headers.** `helmet` sets the standard security headers on the API; `vercel.json`
sets `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` on the
frontend.

**Error responses** never contain stack traces in production, nor internal driver
messages, nor whether an email is registered.

**Secrets** live only in `.env` (git-ignored) and in the deploy platforms'
dashboards. The server refuses to start in production with a `JWT_SECRET` shorter
than 32 characters.

**What SplitMate deliberately does not do.** It does not connect to banks, move
money or process payments. Recording a settlement is an accounting entry only.

---

## Troubleshooting

### `MONGODB_URI is not set` / server exits immediately

You have not created `server/.env`, or it has no `MONGODB_URI`. Copy
`server/.env.example` to `server/.env` and fill it in.

### `MongooseServerSelectionError` / `database: "disconnected"`

1. **IP allow-list** — Atlas → Network Access. Add your current IP for local work;
   `0.0.0.0/0` for Render (whose free tier has no fixed outbound IP).
2. **Password** — the one in the URI is the *database user's* password, not your
   Atlas account password. Reset it under Database Access → Edit → Edit Password.
3. **Special characters** — URL-encode them (`@` → `%40`, `#` → `%23`, `/` → `%2F`).
4. **Database name missing** — it goes between the host and the `?`:
   `...mongodb.net/splitmate?retryWrites=true`.

### `Cannot find module '../../shared/money.js'` on Render or Vercel

The **Root Directory** is set to `server/` or `client/`. Clear it — both platforms
must build from the repository root, because `shared/` sits outside both. See the
deployment sections.

### CORS errors in the browser console

`Access to XMLHttpRequest … has been blocked by CORS policy`:

1. `CORS_ORIGINS` on Render must contain your Vercel origin **exactly**, with the
   scheme and **no trailing slash**.
2. Did you redeploy Render after changing it? Environment changes trigger a
   redeploy; wait for it to finish.
3. Check what the browser is actually sending — a preview deployment has a
   different URL from production.

### The frontend loads but every request fails

- `VITE_API_BASE_URL` is wrong or was set after the build. It must end in `/api`,
  with no trailing slash, and you must **redeploy** after changing it.
- Open the Network tab: if requests go to `localhost:5000` in production, the
  variable was not picked up at build time.

### First request after a while takes 30–60 seconds

Render's free tier sleeps after 15 minutes idle. The next request wakes it. Not a
bug; worth saying out loud when demoing.

### `Port 5000 is already in use`

Another process has it. Stop that process, or set `PORT=5001` in `server/.env`
(and update `VITE_API_BASE_URL` in `client/.env` to match).

### `401` immediately after signing in

Check the clock on your machine — a significantly wrong system time makes freshly
issued JWTs look expired. Also confirm the API was not restarted with a different
`JWT_SECRET`, which invalidates every existing token.

### The first `npm test` run hangs for minutes

`mongodb-memory-server` is downloading a MongoDB binary (~100 MB) on first use.
Later runs reuse it. If it fails behind a proxy or firewall, the download URL is
`https://fastdl.mongodb.org`.

### `npm ci` fails on Render

The lockfile is out of step with `package.json`. Run `npm --prefix server install`
locally, commit the updated `server/package-lock.json`, and push.

### Tailwind classes have no effect

Make sure you are editing files that `tailwind.config.js` scans
(`./index.html`, `./src/**/*.{js,jsx}`), and restart the dev server after changing
the Tailwind config.

---

## What is implemented, and what is not

### Implemented and working

✅ Registration, login, logout, profile editing, password change
✅ JWT auth with bearer tokens, protected routes, authorization on every resource
✅ Personal transactions: full CRUD, filters, search, pagination
✅ Dashboard, monthly/yearly summaries, category/daily/monthly analytics, charts
✅ Monthly category budgets with real spending measured against them
✅ Groups, membership, roles (owner/admin/member), invite codes
✅ Shared expenses with equal, exact and percentage splits
✅ Paise-exact allocation with documented, deterministic rounding
✅ Expense editing and deletion with correct balance recalculation
✅ Net balances, who-owes-whom, and simplified repayments
✅ Full and partial settlements with idempotent submission
✅ Settlement history, filterable, with deletion by the recorder or an admin
✅ Mobile-first responsive UI, hamburger drawer on phones, sidebar on desktop
✅ Loading states, skeletons, empty states, toasts, confirmation dialogs
✅ Accessible labels, visible focus rings, keyboard-navigable dialogs
✅ 179 automated tests (157 API/logic + 22 frontend), all passing locally
✅ Production build, health check, graceful shutdown, deployment configuration

### Known limitations — stated honestly

⚠️ **No email is ever sent.** There is no mail provider configured. Invitations
produce a token and a link that **you** share yourself. The flow is real and the
tokens are checked against the invitee's email — only the delivery is manual.

⚠️ **Not deployed by me.** The deployment configuration is written and the exact
production start command has been verified locally, but the live Render/Vercel
deploy requires your accounts and credentials. The sections above walk through it.
No URL in this README is live until you fill it in.

⚠️ **INR only.** The currency layer is centralised and ready for more, but only
`INR` is accepted today.

⚠️ **Debt simplification is a greedy heuristic**, not a proven minimum, and it
loses the history of who spent with whom. Explained in full
[above](#debt-simplification-and-its-limits).

⚠️ **No password reset.** It would need email delivery. Password *change* (while
signed in) works.

⚠️ **No file uploads.** Avatars are generated initials on a colour; there are no
receipt attachments.

⚠️ **No real-time updates.** If another member adds an expense, you see it on your
next load. No WebSockets or polling.

⚠️ **Multi-document consistency depends on the deployment.** On MongoDB Atlas (a
replica set) expense writes use real transactions. On a standalone `mongod`,
transactions are unavailable, so the code falls back to an ordered write with a
compensating delete. The tests run against an in-memory replica set, so the
transactional path is the one under test.

⚠️ **Removed members** are deactivated, not deleted, and only once their balance is
zero. Their historic shares still count, which is what keeps the group balanced.

⚠️ **No data export** (CSV/PDF) and no recurring transactions.

⚠️ **Render's free tier sleeps**, so the first request after idling is slow.

---

## Resume description

> **SplitMate — Full-Stack Expense Tracker & Group Bill Splitter** · *React, Node.js, Express, MongoDB*
>
> Built a mobile-first MERN application that combines personal expense tracking
> with Splitwise-style shared-expense settlement. Designed a decimal-safe
> financial core in integer paise with deterministic rounding, guaranteeing that
> equal, exact and percentage splits reconcile to the expense total exactly, and
> implemented a greedy debt-simplification algorithm that reduces group
> repayments to at most *n−1* transfers. Shared a single implementation of all
> money logic between the Express API and the React client, so the UI's live split
> preview is computed by the same code that persists it. Secured the API with
> JWT authentication, bcrypt hashing, Zod request validation, per-resource
> authorization and rate limiting, verified by tests for cross-user access
> isolation. Wrote 179 automated tests (Vitest, Supertest against an in-memory
> MongoDB replica set, React Testing Library) covering rounding edge cases,
> balance invariants, concurrent duplicate settlements and authorization
> boundaries. Deployed on Vercel, Render and MongoDB Atlas.

**Shorter variant**

> Mobile-first MERN expense tracker and group bill splitter. Decimal-safe
> integer-paise accounting with deterministic rounding, three split strategies,
> and greedy debt simplification. JWT auth, Zod validation and per-resource
> authorization, with 179 tests covering rounding, balance invariants and access
> isolation. React + Vite + Tailwind on Vercel; Express + Mongoose on Render and
> MongoDB Atlas.

**Talking points for an interview**

- Why integer paise, and what breaks without them.
- How the leftover paise in an uneven equal split is allocated, and why it must be
  deterministic across edits.
- Why balances are recomputed rather than cached, and what that buys.
- Why a non-member gets `404` and not `403`.
- Why the split logic lives in `shared/` and what that forced in the deployment
  configuration.
- How duplicate settlement submissions are made safe with an idempotency key plus a
  partial unique index.

---

## Suggested commit messages

If you are committing this in stages, a sensible sequence:

```
chore: scaffold client and server workspaces with tooling
feat(shared): add decimal-safe money, split and balance core
test(shared): cover rounding, allocation and balance invariants
feat(server): add Mongoose models, indexes and validation
feat(server): add JWT auth, Zod validation and error handling
feat(server): add personal transactions, budgets and analytics
feat(server): add groups, membership and invitations
feat(server): add shared expenses with equal, exact and percentage splits
feat(server): add balances, debt simplification and settlements
test(server): cover auth, access isolation and financial edge cases
feat(client): add design system, layouts and routing
feat(client): add dashboard, transactions and budget screens
feat(client): add group expenses, balances and settlement screens
test(client): cover sign-in and the live split preview
chore: add Render and Vercel deployment configuration
docs: add README and API reference
```

---

## Licence

Released under the MIT Licence. All demo data is fictional.
