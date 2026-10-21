# SplitMate API reference

Base URL: `{API_BASE}/api` — for example `http://localhost:5000/api` locally, or
`https://splitmate-api.onrender.com/api` in production.

---

## Conventions

### Response envelope

Every successful response:

```json
{ "success": true, "data": { }, "meta": { } }
```

`meta` is present only on paginated list endpoints.

Every error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some of the information you entered is not valid.",
    "details": [{ "field": "email", "message": "Please enter a valid email address." }]
  }
}
```

`details` appears only for validation failures. Stack traces are included **only**
when `NODE_ENV` is not `production`, and only for 5xx responses.

### Authentication

Send the JWT as a bearer token:

```
Authorization: Bearer <token>
```

The API also accepts an `httpOnly` cookie named `splitmate_token`, which it sets on
register and login. The SPA uses the bearer header because the browser treats the
cookie as third-party when the client (Vercel) and API (Render) are on different
sites. See "Security notes" in the root README.

### Money

**Every monetary value in a response is an integer number of paise** (1 rupee =
100 paise), always in a field ending in `Paise`.

**Requests** accept a human rupee value in the `amount` / `limit` field — a number
or a string, with or without commas (`1250.5`, `"1250.50"`, `"1,250.50"`). The
server converts it to paise and never does float arithmetic afterwards.

Percentages are sent as plain numbers (`33.33`) and stored as integer basis points.

### Dates

Send `YYYY-MM-DD` (or any ISO 8601 string). Dates are anchored at UTC midnight.
A `to=` filter includes the whole of that day.

### Pagination

List endpoints accept `?page=` (default 1) and `?limit=` (default 20, max 100) and
return:

```json
"meta": {
  "page": 1, "limit": 20, "total": 57, "totalPages": 3,
  "hasNextPage": true, "hasPreviousPage": false
}
```

### Common error codes

| Status | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Request body is not valid JSON |
| 400 | `INVALID_ID` | A path parameter is not a valid ObjectId |
| 401 | `TOKEN_MISSING` | No credential sent |
| 401 | `TOKEN_INVALID` | Token is malformed or signed with another key |
| 401 | `TOKEN_EXPIRED` | Token is past its expiry |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `INSUFFICIENT_ROLE` | Member tried an owner/admin-only action |
| 403 | `CORS_REJECTED` | Origin is not in `CORS_ORIGINS` |
| 404 | `NOT_FOUND` | Resource missing, or not yours |
| 404 | `NOT_A_MEMBER` | Group exists but you are not in it (deliberately a 404) |
| 409 | `EMAIL_TAKEN` | Registration email already in use |
| 409 | `ALREADY_MEMBER` | Person is already in the group |
| 409 | `MEMBER_HAS_BALANCE` | Cannot remove a member who still owes or is owed |
| 409 | `CONCURRENT_MODIFICATION` | Someone else edited the record first |
| 422 | `VALIDATION_ERROR` | Request failed schema validation |
| 422 | `INVALID_AMOUNT` | Shares do not reconcile to the total |
| 422 | `PAYER_NOT_MEMBER` / `PARTICIPANT_NOT_MEMBER` | Someone in the split is not in the group |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server fault |

---

## Health

### `GET /api/health`
No auth. Used by Render's health check.

```json
{ "success": true, "data": {
  "status": "ok", "service": "splitmate-api", "environment": "production",
  "database": "connected", "uptimeSeconds": 412, "timestamp": "2026-10-20T10:09:40.064Z"
}}
```

### `GET /api`
No auth. Lists the top-level route groups.

---

## Authentication

### `POST /api/auth/register`
No auth. Rate limited: 20 per hour per IP.

Request: `{ "name": "Asha Rao", "email": "asha@example.com", "password": "Password123" }`

Password rules: 8–128 characters, at least one letter and one digit.

`201` → `{ "data": { "user": {...}, "token": "..." } }`

Errors: `422 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.

### `POST /api/auth/login`
No auth. Rate limited: 10 per 15 minutes per IP.

Request: `{ "email": "...", "password": "..." }` → `200` with `user` and `token`.

Errors: `401 INVALID_CREDENTIALS` — identical message and status whether the email
is unknown or the password is wrong, so accounts cannot be enumerated.

### `POST /api/auth/logout`
No auth required. Clears the cookie. The client also discards its stored token.

### `GET /api/auth/me`
Auth required. → `{ "data": { "user": {...} } }`

### `PATCH /api/auth/me`
Auth required. Body: `{ "name"?, "avatarColor"? }` (`avatarColor` is `#rrggbb`).

### `POST /api/auth/change-password`
Auth required. Rate limited. Body: `{ "currentPassword", "newPassword" }`.

Errors: `401 INVALID_CREDENTIALS` if the current password is wrong.

### `GET /api/auth/users/search?q=`
Auth required. `q` must be at least 3 characters. Returns at most 10 public
profiles (`id`, `name`, `email`, `avatarColor`), excluding yourself. Deliberately
narrow so the endpoint cannot be used to enumerate the user base.

---

## Personal transactions

All routes require auth and are **scoped to the signed-in user**. Asking for
another user's transaction id returns `404`, never their data.

### `GET /api/transactions`
Query: `page`, `limit`, `type` (`income`|`expense`), `category`, `from`, `to`,
`search`, `sort` (`date`|`-date`|`amount`|`-amount`, default `-date`).

→ `{ "data": { "transactions": [...] }, "meta": {...} }`

Each transaction:

```json
{
  "id": "...", "type": "expense", "amountPaise": 45075, "category": "food",
  "description": "Lunch", "paymentMethod": "upi",
  "date": "2026-03-15T00:00:00.000Z", "notes": "",
  "createdAt": "...", "updatedAt": "..."
}
```

### `POST /api/transactions`
Body:

```json
{
  "type": "expense", "amount": "450.75", "category": "food",
  "description": "Lunch", "paymentMethod": "upi",
  "date": "2026-03-15", "notes": ""
}
```

Categories must match the type: income uses `salary, business, freelance,
investment, gift, refund, other`; expenses use `food, groceries, transportation,
shopping, rent, bills, entertainment, healthcare, education, travel, other`.

`201` → `{ "data": { "transaction": {...} } }`. Unknown body fields are rejected.

### `GET /api/transactions/:id`
### `PATCH /api/transactions/:id`
Partial update; same field rules.
### `DELETE /api/transactions/:id`
→ `{ "data": { "id": "..." } }`

### `GET /api/transactions/summary`
Query: `year`, `month`, or `from`/`to`. With `year` only, the window is that whole
year; with neither, the current year.

```json
{ "data": {
  "periodStart": "...", "periodEnd": "...",
  "totalIncomePaise": 5000000, "totalExpensePaise": 1700000,
  "balancePaise": 3300000, "incomeCount": 1, "expenseCount": 3,
  "savingsRateBasisPoints": 6600
}}
```

`balancePaise` = income − expenses **within the window**. It is a cash-flow figure,
not a net-worth figure. Group expenses and settlements are never included.

### `GET /api/transactions/analytics/categories`
Same query. Returns `categories[]` sorted by spend, each with `totalPaise`,
`count` and `shareBasisPoints`. Income is excluded.

### `GET /api/transactions/analytics/monthly?year=`
Returns all 12 months, zero-filled, with `incomePaise`, `expensePaise`,
`balancePaise`.

### `GET /api/transactions/analytics/daily`
Returns `days[]` with `date` (`YYYY-MM-DD`), `incomePaise`, `expensePaise`.

### `GET /api/transactions/analytics/payment-methods`
Returns `methods[]` with `method`, `totalPaise`, `count`.

---

## Budgets

Auth required; scoped to the signed-in user.

### `GET /api/budgets?year=&month=`
Defaults to the current month.

```json
{ "data": {
  "year": 2026, "month": 3,
  "items": [{
    "id": "...", "category": "food", "year": 2026, "month": 3,
    "limitPaise": 600000, "spentPaise": 500000, "remainingPaise": 100000,
    "usedBasisPoints": 8333, "isOverBudget": false
  }],
  "unbudgetedSpending": [{ "category": "rent", "spentPaise": 1200000 }],
  "totals": { "totalLimitPaise": 600000, "totalSpentPaise": 500000,
              "remainingPaise": 100000, "usedBasisPoints": 8333, "overBudgetCount": 0 }
}}
```

### `POST /api/budgets`
Body: `{ "category", "year", "month", "limit" }`.

**Upsert**: posting the same `(category, year, month)` again updates the limit and
returns the same budget id, so a double submit cannot create a duplicate.
Returns `201`.

### `DELETE /api/budgets/:id`

---

## Groups

Auth required. **Every `/:groupId` route is gated by active membership.** A
non-member receives `404 NOT_A_MEMBER` — not `403` — so changing an id in a URL
cannot confirm whether a group exists.

### `GET /api/groups`
Groups you belong to, each with your own net balance in it.

```json
{ "data": {
  "groups": [{
    "id": "...", "name": "Goa Trip 2026", "description": "...", "type": "trip",
    "accentColor": "#10b981", "role": "owner", "memberCount": 4,
    "expenseCount": 5, "totalExpensePaise": 6735050,
    "myNetBalancePaise": 657903, "createdAt": "...", "archivedAt": null
  }],
  "totals": { "owedToUserPaise": 863903, "userOwesPaise": 0, "netPaise": 863903 }
}}
```

### `POST /api/groups`
Body: `{ "name", "description"?, "type"?, "accentColor"?, "memberIds"?, "inviteEmails"? }`.
`type` is one of `trip, roommates, friends, event, household, other`.
The creator becomes the `owner`. `201`.

### `GET /api/groups/:groupId`
→ `{ "data": { "group", "members", "invitations", "myRole" } }`.
`invitations` is populated only for owners and admins.

Each member: `{ userId, name, email, avatarColor, role, status, joinedAt }`
where `role` ∈ `owner|admin|member` and `status` ∈ `active|removed`.

### `PATCH /api/groups/:groupId`
Owner/admin. Body: `{ "name"?, "description"?, "type"?, "accentColor"?, "archived"? }`.

### `DELETE /api/groups/:groupId`
**Owner only.** Permanently deletes the group and all of its expenses, shares,
settlements, memberships and invitations.

---

## Group members

### `GET /api/groups/:groupId/members`
Any member.

### `POST /api/groups/:groupId/members`
Owner/admin. Body: `{ "userId" }` or `{ "email" }` — the person must already have a
SplitMate account, otherwise `404 USER_NOT_REGISTERED` (invite them instead).
Re-adding a previously removed member reactivates their existing membership, which
preserves the expense history that points at them. `201`.

### `DELETE /api/groups/:groupId/members/:userId`
Owner/admin. Refused with `409 MEMBER_HAS_BALANCE` unless that member's net balance
is exactly zero — removing someone mid-debt would silently drop the obligation.
The membership is marked `removed`, not deleted, so historic shares still count.

---

## Invitations

SplitMate **does not send email** — no mail provider is configured. The API returns
a token and the inviter shares the link themselves.

### `POST /api/groups/:groupId/invitations`
Owner/admin. Body: `{ "email" }`. Any previous pending invitation for that address
is revoked first. `201` →

```json
{ "data": { "invitation": {
  "id": "...", "email": "...", "token": "4f2c...", "status": "pending",
  "expiresAt": "...", "isRegisteredUser": true
}}}
```

### `GET /api/groups/:groupId/invitations` — owner/admin, pending only.
### `DELETE /api/groups/:groupId/invitations/:id` — owner/admin, revokes it.
### `GET /api/groups/invitations/mine` — pending invitations addressed to your email.

### `POST /api/groups/invitations/accept`
Body: `{ "token" }`. The signed-in account's email **must match** the invited
address, so a forwarded link cannot be redeemed by someone else.

Errors: `404 INVITATION_INVALID`, `400 INVITATION_EXPIRED` (14 days),
`403 INVITATION_EMAIL_MISMATCH`.

---

## Group expenses

### `GET /api/groups/:groupId/expenses`
Any member. Query: `page`, `limit`, `category`, `paidBy`, `from`, `to`, `search`.

```json
{
  "id": "...", "groupId": "...", "description": "Seafood dinner",
  "amountPaise": 485050, "category": "food", "date": "...",
  "splitType": "EQUAL", "notes": "",
  "paidBy": { "userId": "...", "name": "Kabir", "email": "...", "avatarColor": "#8b5cf6" },
  "shares": [{ "userId": "...", "name": "Aarav", "amountPaise": 121263, "basisPoints": null }],
  "createdAt": "...", "updatedAt": "..."
}
```

**`shares` always sums exactly to `amountPaise`.**

### `POST /api/groups/:groupId/expenses`
Any member. Body:

```json
{
  "description": "Seafood dinner",
  "amount": "4850.50",
  "category": "food",
  "date": "2026-03-15",
  "paidBy": "<userId>",
  "splitType": "EQUAL",
  "participants": [{ "userId": "..." }, { "userId": "..." }],
  "notes": ""
}
```

Per split type:

| `splitType` | `participants` entries | Rule |
| --- | --- | --- |
| `EQUAL` | `{ userId }` | `floor(total / n)` each; the `total mod n` leftover paise go one each to the first participants in id order |
| `EXACT` | `{ userId, amount }` | Amounts must sum **exactly** to the total |
| `PERCENT` | `{ userId, percent }` | Percentages must sum to exactly 100; paise allocated by largest remainder |

`201` → the created expense.

Errors: `422 INVALID_AMOUNT` (shares do not reconcile), `422 PAYER_NOT_MEMBER`,
`422 PARTICIPANT_NOT_MEMBER`, `422 VALIDATION_ERROR`.

The expense and its shares are written atomically — inside a MongoDB transaction
on a replica set (Atlas), or with a compensating delete on a standalone mongod. A
rejected expense writes nothing at all.

### `GET /api/groups/:groupId/expenses/:id`

### `PUT /api/groups/:groupId/expenses/:id`
Full replacement; same body as create. Shares are rewritten and balances
recalculated. A rejected edit leaves the previous allocation untouched.

### `DELETE /api/groups/:groupId/expenses/:id`
Deletes the expense and its shares; balances update immediately.

---

## Balances and simplified debts

### `GET /api/groups/:groupId/balances`
Any member. Everything here is **computed on request** from the stored shares and
settlements — no balance is cached, so nothing can drift.

```json
{ "data": {
  "members": [ ... ],
  "netBalances": [
    { "userId": "...", "name": "Aarav", "avatarColor": "#10b981",
      "status": "active", "amountPaise": 206000 }
  ],
  "pairwiseDebts": [
    { "from": { "userId": "...", "name": "Kabir", ... },
      "to":   { "userId": "...", "name": "Aarav", ... },
      "amountPaise": 140000 }
  ],
  "simplifiedDebts": [ ...same shape... ],
  "totals": { "totalExpensePaise": 862075, "totalSettledPaise": 0,
              "expenseCount": 2, "settlementCount": 0 }
}}
```

- **`netBalances`** — `paid − owed + settlementsPaid − settlementsReceived`.
  Positive means the group owes them. **Always sums to exactly 0.**
- **`pairwiseDebts`** — the real obligations between each pair, netted both ways.
- **`simplifiedDebts`** — the shortest set of transfers that clears every balance
  (greedy largest-debtor/largest-creditor matching; at most `n − 1` transfers).
- **`totals.totalExpensePaise`** never includes settlements.

Members who left the group but appear in historic expenses are still listed, with
`status: "removed"`, so the balances continue to sum to zero.

---

## Settlements

A settlement is an **accounting record that one member repaid another**. SplitMate
moves no money and connects to no bank or payment processor.

### `GET /api/groups/:groupId/settlements`
Any member. Query: `page`, `limit`, `userId` (either side of the transfer).

```json
{
  "id": "...", "groupId": "...",
  "from": { "userId": "...", "name": "Kabir", "avatarColor": "..." },
  "to":   { "userId": "...", "name": "Aarav", "avatarColor": "..." },
  "amountPaise": 500000, "method": "upi", "note": "Part payment",
  "settledAt": "...", "recordedBy": "...", "createdAt": "..."
}
```

### `POST /api/groups/:groupId/settlements`
Any member. Body:

```json
{
  "fromUser": "<userId>", "toUser": "<userId>", "amount": "5000",
  "method": "upi", "note": "Part payment", "settledAt": "2026-03-20",
  "clientRequestId": "a1b2c3d4e5f6a7b8"
}
```

`method` ∈ `cash, upi, bank_transfer, other`. Both people must be active members
and must differ. **Partial settlements are normal** — the amount need not match the
outstanding debt.

**Idempotency.** `clientRequestId` (8–64 chars) makes the request safe to repeat.
A repeat returns `200` with `"duplicate": true` and the original settlement,
instead of recording the repayment twice. A fresh settlement returns `201` with
`"duplicate": false`. A unique index makes this safe even for genuinely concurrent
duplicate submissions.

Errors: `422 NOT_A_MEMBER`, `422 VALIDATION_ERROR` (zero/negative, or settling with
yourself).

### `DELETE /api/groups/:groupId/settlements/:id`
Only the person who recorded it, or a group owner/admin — otherwise `403`.
The debt it cleared reappears in the balances.

---

## Rate limits

| Scope | Window | Limit |
| --- | --- | --- |
| `POST /api/auth/login`, `POST /api/auth/change-password` | 15 min | 10 |
| `POST /api/auth/register` | 60 min | 20 |
| Everything under `/api` | 15 min | 600 |

Exceeding a limit returns `429 RATE_LIMITED`. Limits are disabled under
`NODE_ENV=test`.
