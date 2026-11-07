import pypandoc

readme = r"""<div align="center">

# SplitMate

### Track your spending. Split shared expenses. Settle up with confidence.

A mobile-first personal finance and group expense management application built with the **MERN stack**. SplitMate brings individual expense tracking, shared bills, transparent balances, and settlement management together in one place.

[Features](#features) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started) · [API & Architecture](#architecture) · [Testing](#testing) · [Deployment](#deployment)

</div>

---

## Overview

SplitMate helps individuals understand their spending while making shared expenses easier to manage. Use it to track personal income and expenses, set monthly budgets, organize group spending, calculate who owes whom, and record full or partial settlements.

Whether you're managing a trip, a shared apartment, or everyday expenses with friends, SplitMate keeps the calculations transparent and accurate.

> **Project status:** The application and deployment configuration are documented here. Add your production URLs and screenshots after completing your deployments.

## Live Demo

| Resource | Link |
|---|---|
| Frontend | https://splitmate-alpha-eosin.vercel.app/ |
| Backend API | https://splitmate-suur.onrender.com |
| Repository | https://github.com/IndhraVarma/SplitMate |

### Screenshots

| Dashboard | Group balances | Shared expense |
|---|---|---|
| `docs/screenshots/dashboard.png` | `docs/screenshots/balances.png` | `docs/screenshots/shared-expense.png` |

## Features

### Personal expense management

- User registration, login, logout, profile updates, and password changes.
- Dashboard showing income, expenses, and balance for the selected period.
- Create, view, update, and delete income and expense transactions.
- Expense and income categories.
- Transaction details including amount, date, category, description, payment method, and notes.
- Search, filters, and paginated transaction lists.
- Monthly and yearly summaries.
- Daily, monthly, and category-wise spending analytics.
- Interactive charts for spending trends and category breakdowns.
- Monthly budgets for individual expense categories.
- Recent activity, loading states, and helpful empty states.

### Group expense splitting

- Create groups for trips, roommates, friends, events, or households.
- Add registered users or generate invitation codes for other members.
- Manage group members and roles.
- Record shared expenses with a payer, date, category, description, and participants.
- Support for **equal**, **exact-amount**, and **percentage-based** splits.
- Live split preview using the same financial logic as the backend.
- Edit or delete expenses and recalculate balances.
- View net balances and individual repayment relationships.
- Simplify repayments to reduce the number of transfers.
- Record full or partial settlements.
- View settlement history and filter it by member.
- Restrict group data and actions to authorized members.

## Accurate Financial Calculations

Financial accuracy is a core design principle in SplitMate.

### Integer-based currency handling

JavaScript floating-point arithmetic can introduce rounding errors in financial calculations. To avoid this, SplitMate stores and processes monetary values as **integer paise**.

- ₹1 = 100 paise.
- Monetary values are stored as integers in the database and used as integers in the API and shared financial utilities.
- Rupee input is converted to paise at the application boundary.
- Values are formatted as rupees only when displayed to the user.

For example, `₹1,250.50` is represented internally as `125050` paise.

### Shared financial logic

The financial calculation modules are maintained in the root-level `shared/` directory and imported by both the React frontend and Express backend.

| Module | Responsibility |
|---|---|
| `shared/money.js` | Currency parsing, rounding, and formatting |
| `shared/split.js` | Equal, exact, and percentage-based allocations |
| `shared/balance.js` | Net balances, debt relationships, and debt simplification |

This shared implementation ensures that the split preview shown to a user matches the calculation performed by the server.

### Split strategies

**Equal split**

The total is divided evenly. Any remaining paise are distributed deterministically in user-ID order, ensuring that repeated calculations produce consistent results.

Example: ₹10.00 split between three people:

| Participant | Share |
|---|---:|
| Person 1 | ₹3.34 |
| Person 2 | ₹3.33 |
| Person 3 | ₹3.33 |
| **Total** | **₹10.00** |

**Exact-amount split**

Each participant receives a specified amount. The application validates that all allocations add up to the expense total. Invalid allocations are rejected.

**Percentage split**

The application uses the largest-remainder method to distribute indivisible paise. The resulting shares reconcile exactly to the original total.

### Group balance model

SplitMate distinguishes between expenses, outstanding debts, and settlements.

| Record | Meaning | Counts as group spending? |
|---|---|---|
| Expense | Money paid on behalf of the group | Yes |
| Debt | Derived outstanding obligation | No |
| Settlement | Repayment between group members | No |

A member's net balance is calculated as:

```text
net balance =
    expenses paid
  - expense shares assigned
  + settlements paid
  - settlements received
```

- A positive balance means the group owes that member.
- A negative balance means that member owes the group.
- The sum of all member balances in a group is always zero.

Balances are recalculated from expense shares and settlement records rather than relying on cached values.

### Debt simplification

The debt simplification algorithm matches debtors with creditors to produce a smaller set of repayment instructions.

**Important:** This is a deterministic greedy heuristic, not a guarantee of the mathematically minimum number of transfers. It preserves the overall balances but may not preserve the original pairwise spending relationships. The application therefore retains the individual debt view alongside the simplified repayment suggestions.

### Personal and group accounting

Personal transactions are kept separate from group expenses and settlements. Paying a shared bill does not automatically count as personal spending, and receiving a repayment does not automatically count as personal income.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, JavaScript |
| Styling | Tailwind CSS 3 |
| Routing | React Router 6 |
| Charts | Recharts 2 |
| HTTP client | Axios |
| Backend | Node.js 22, Express 4 |
| Database | MongoDB Atlas, Mongoose 8 |
| Authentication | JWT, bcryptjs |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit, cookie-parser |
| Testing | Vitest, Supertest, React Testing Library, mongodb-memory-server |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## Architecture

The project uses a shared financial core so that the frontend and backend rely on the same currency, split, and balance calculations.

```text
SplitMate/
├── shared/
│   ├── money.js
│   ├── split.js
│   └── balance.js
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── tests/
│   └── .env.example
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── validators/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── scripts/
│   │   ├── tests/
│   │   ├── app.js
│   │   └── server.js
│   └── .env.example
│
├── docs/
│   └── API.md
├── render.yaml
├── vercel.json
└── package.json
```

### Design principles

- Keep controllers thin and place business logic in service modules.
- Maintain financial calculations in one shared implementation.
- Apply group membership authorization through centralized middleware.
- Validate request bodies, query parameters, and route parameters with Zod.
- Use a consistent API response format and centralized error handling.
- Build the interface from reusable components and semantic design tokens.

## Getting Started

### Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) 18.18 or newer (the project was developed with Node.js 22).
- npm 9 or newer.
- [Git](https://git-scm.com/).
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account, or use the development in-memory database option.

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/splitmate.git
cd splitmate
```

Replace the repository URL with your actual GitHub URL.

### 2. Install dependencies

Run this command from the project root:

```bash
npm run install:all
```

Alternatively, install each workspace separately:

```bash
npm --prefix server install
npm --prefix client install
```

### 3. Configure environment variables

Create local environment files from the examples.

**macOS / Linux**

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**Windows PowerShell**

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

### 4. Configure the backend

Update `server/.env` with your MongoDB connection string and a secure JWT secret.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Example:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<your-long-random-secret>
PORT=5000
NODE_ENV=development
```

Use your own MongoDB Atlas credentials. If your password contains special characters, URL-encode them before adding the connection string.

### 5. Configure the frontend

The default local API URL is:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

This value belongs in `client/.env`.

### 6. Start the application

Open two terminals at the repository root.

**Terminal 1 — Backend**

```bash
npm run dev:server
```

The API runs at `http://localhost:5000`.

**Terminal 2 — Frontend**

```bash
npm run dev:client
```

The frontend runs at `http://localhost:5173`.

Open `http://localhost:5173` in your browser.

Check backend health at:

```text
http://localhost:5000/api/health
```

### Optional: Run with an in-memory database

To explore the application without configuring MongoDB Atlas:

```bash
npm --prefix server run dev:memory
```

This starts a temporary in-memory MongoDB instance, seeds demo data, and runs the API. Data is not persisted. This mode is intended for development only.

## Environment Variables

### Backend — `server/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWTs |
| `PORT` | No | `5000` | API port; Render supplies this in production |
| `NODE_ENV` | No | `development` | Runtime environment |
| `JWT_EXPIRES_IN` | No | `7d` | JWT lifetime |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt hashing cost |
| `CORS_ORIGINS` | No | Localhost origins | Comma-separated allowed frontend origins |
| `SEED_PASSWORD` | No | `Password123!` | Password assigned to seeded demo accounts |

For production, use a strong JWT secret and an appropriate bcrypt cost factor. Configure `CORS_ORIGINS` with the exact frontend origin.

### Frontend — `client/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes in production | `http://localhost:5000/api` | Backend API base URL, including `/api` |

> **Security:** Variables prefixed with `VITE_` are included in the frontend bundle and are visible to users. Never store passwords, private keys, or other secrets in frontend environment variables.

## Available Scripts

Run root-level scripts from the repository root.

| Command | Description |
|---|---|
| `npm run install:all` | Install client and server dependencies |
| `npm run dev:server` | Start the backend in development mode |
| `npm run dev:client` | Start the Vite development server |
| `npm run seed` | Reset and seed the configured database |
| `npm test` | Run client and server test suites |
| `npm run test:server` | Run backend tests |
| `npm run test:client` | Run frontend tests |
| `npm run build` | Build the frontend for production |

Additional scripts are available inside the `server/` and `client/` workspaces.

## Demo Data

Seed the database using:

```bash
npm run seed
```

The seed script creates fictional users, personal transactions, budgets, groups, expenses, and settlement examples.

**Warning:** The seed script deletes existing documents in the database specified by `MONGODB_URI` before inserting demo data. Never run it against a database containing data you need to keep. The script refuses to run when `NODE_ENV=production`.

The default demo password is controlled by `SEED_PASSWORD`. Change it before sharing demo access, and never use seeded credentials for real accounts.

## Testing

Run all tests:

```bash
npm test
```

Or run the suites independently:

```bash
npm run test:server
npm run test:client
```

The backend tests use `mongodb-memory-server` with an in-memory replica set, allowing database transaction paths to be tested without using a real database.

### Test coverage

**Financial logic**

- Currency parsing and rounding.
- Equal, exact, and percentage-based allocations.
- Deterministic handling of leftover paise.
- Balance calculations and zero-sum group invariants.
- Full and partial settlements.
- Debt simplification and repayment consistency.
- Edge cases involving small amounts and multiple participants.

**Backend API**

- Registration and login validation.
- Password hashing and authentication.
- Token validation and protected routes.
- User-level data isolation.
- Group membership and role-based authorization.
- Expense creation, editing, and deletion.
- Settlement validation and duplicate-submission protection.
- Request validation and error handling.

**Frontend**

- Authentication form behaviour.
- Shared-expense split preview.
- Allocation reconciliation and invalid split handling.

### Reported test results

The supplied project notes report the following local results:

| Suite | Test files | Tests passed |
|---|---:|---:|
| Backend | 10 | 157 |
| Frontend | 3 | 22 |
| **Total** | **13** | **179** |

Run the test commands in your own environment to verify the current results after making changes.

## Deployment

The project is structured to deploy from the **repository root** because both the client and server import modules from `shared/`.

### Backend deployment — Render

1. Push the repository to GitHub.
2. Create a new Web Service in [Render](https://render.com/).
3. Connect the GitHub repository.
4. Configure the service:

| Setting | Value |
|---|---|
| Runtime | Node |
| Root Directory | Leave blank |
| Build Command | `npm --prefix server ci --omit=dev` |
| Start Command | `npm --prefix server start` |
| Health Check Path | `/api/health` |

5. Add the required environment variables:

```env
NODE_ENV=production
MONGODB_URI=<your-mongodb-atlas-uri>
JWT_SECRET=<your-production-secret>
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGINS=<your-vercel-origin>
```

Do not manually set `PORT` on Render; the platform supplies it.

### Frontend deployment — Vercel

1. Import the same GitHub repository into [Vercel](https://vercel.com/).
2. Keep the project root as the repository root.
3. Configure the build:

| Setting | Value |
|---|---|
| Framework Preset | Other |
| Root Directory | Repository root |
| Build Command | `npm --prefix client run build` |
| Output Directory | `client/dist` |
| Install Command | `npm --prefix client ci` |

4. Add the frontend environment variable:

```env
VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api
```

5. Deploy the frontend.

### Configure production CORS

After deploying the frontend, copy its production origin and set it as `CORS_ORIGINS` in the Render environment settings.

Example:

```env
CORS_ORIGINS=https://your-splitmate-app.vercel.app
```

Use the exact origin, including `https://`, without a trailing slash. Redeploy the backend after changing the environment variable.

> **Build configuration note:** Do not set the Render or Vercel root directory to `server/` or `client/`. The shared financial modules are outside both directories, so builds must run from the repository root.

## Security

The application includes several security measures:

- Passwords are hashed with bcrypt.
- JWT authentication protects private routes.
- Zod schemas validate request bodies, query parameters, and route parameters.
- User-owned database queries are scoped to the authenticated user.
- Group routes enforce membership authorization.
- Rate limiting is applied to sensitive endpoints.
- Helmet configures standard API security headers.
- CORS restricts browser access to configured origins.
- Free-text search input is escaped before being used in regular expressions.
- Production error responses avoid exposing stack traces and internal details.
- Secrets are supplied through environment variables and should not be committed to Git.

### Authentication implementation note

The documented client stores the bearer token in `localStorage` and sends it through the `Authorization` header. The API also sets an `httpOnly` cookie. Because browser storage is accessible to JavaScript, an XSS vulnerability could expose a token stored in `localStorage`. Review this trade-off before production use and consider a same-site deployment with cookie-only authentication where feasible.

### Scope

SplitMate is an expense tracking and accounting application. It does **not** connect to bank accounts, transfer money, or process payments. Recording a settlement updates the application's accounting records only.

## Known Limitations

- Invitation links are generated, but email delivery is not configured; links must be shared manually.
- Currency support is currently limited to INR.
- Debt simplification uses a greedy heuristic and does not guarantee the globally minimum number of transfers.
- Password changes are supported, but password reset by email is not implemented.
- Receipt and other file uploads are not implemented.
- Group updates are not real-time; users see changes when they reload or revisit the relevant view.
- CSV/PDF export and recurring transactions are not implemented.
- Removed members are deactivated rather than deleted so historical accounting remains intact.
- On MongoDB Atlas replica sets, expense writes can use database transactions. Standalone MongoDB deployments have different transaction capabilities.
- Render's free service tier may sleep after inactivity, increasing the response time of the first request.

## Troubleshooting

| Problem | What to check |
|---|---|
| `MONGODB_URI is not set` | Confirm `server/.env` exists and contains `MONGODB_URI`. |
| MongoDB connection fails | Check the Atlas database credentials, network access list, encoded password, and database name in the URI. |
| `Cannot find module '../../shared/money.js'` | Ensure the deployment root directory is the repository root. |
| Browser CORS error | Confirm `CORS_ORIGINS` exactly matches the frontend origin and redeploy the API. |
| Frontend requests the wrong API | Check `VITE_API_BASE_URL`; it must include `/api`. Rebuild and redeploy after changing it. |
| First API request is slow | The Render free instance may be waking from inactivity. |
| Port is already in use | Stop the process using the port or configure a different local `PORT`. |
| `401` after login | Check the system clock and confirm the API is using the expected `JWT_SECRET`. |
| First test run takes a long time | `mongodb-memory-server` may be downloading its MongoDB binary. |

## Future Improvements

Potential areas for future development include:

- Email-based invitation delivery and password reset.
- Exporting personal and group reports to CSV or PDF.
- Receipt attachments and expense documentation.
- Real-time group expense and settlement updates.
- Recurring transactions and budget notifications.
- Multi-currency support.

These are possible extensions, not features currently claimed as implemented.

## Resume Description

**SplitMate — Full-Stack Expense Tracker & Group Bill Splitter**  
*React · Node.js · Express · MongoDB · Tailwind CSS*

Developed a mobile-first MERN application for personal expense tracking and group bill splitting. Designed a shared financial calculation layer using integer-paise accounting to avoid floating-point errors, with deterministic equal, exact, and percentage-based expense allocation. Implemented group balance calculation, debt simplification, and full or partial settlements. Built secure REST APIs using JWT authentication, bcrypt password hashing, Zod validation, rate limiting, and resource-level authorization. Added automated tests for financial edge cases, balance invariants, and access isolation.

## License

This project is released under the **MIT License**. Demo data is fictional.

---

<div align="center">

**SplitMate** — Make shared expenses simpler.

</div>
"""

output_path = "/mnt/data/README.md"
pypandoc.convert_text(readme, "md", format="md", outputfile=output_path, extra_args=["--standalone"])
print(f"Created: {output_path}")
