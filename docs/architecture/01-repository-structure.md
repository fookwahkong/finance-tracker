# Repository Structure

The layout follows one guiding idea: **keep business logic independent of how
data arrives or where it's stored.** A transaction typed on the web, sent from a
Telegram bot, or extracted from a PDF all flows through the same validation and
persistence code. That principle is why the repo is split the way it is.

```
finance-tracker/
├── api/          Vercel serverless entry point (Mangum-wrapped FastAPI)
├── backend/      FastAPI app + HTTP routers (the transport layer)
├── core/         Transport-agnostic business logic (the heart of the app)
├── frontend/     React + Vite single-page app
├── db/           Postgres schema + row-level-security migrations
├── tests/        pytest suite
├── docs/         This documentation
└── vercel.json   Build, routing, and cron configuration
```

## Why each folder exists

### `core/` — the reason the rest stays simple

This is the most important boundary in the codebase. `core/` holds **pure
business logic with no knowledge of HTTP, Vercel, or request objects.** Because
it's decoupled from transport, four different ingestion channels reuse it, and it
can be unit-tested without spinning up a server or a database.

```
core/
├── parsing/        LLM seam: turn free text → structured transaction JSON
│   ├── __init__.py   provider selection + prompt assembly
│   ├── claude.py     Anthropic provider
│   ├── ollama.py     local provider
│   ├── prompt.py     system prompt
│   └── extract.py    strict JSON extraction from model output
├── statement/      bank-statement PDF → rows → categorised suggestions
├── investments/    Polygon.io client, caching, and AI analysis
├── calc/           report aggregation + period helpers
├── claims.py       pure settlement math for shared-expense claims
├── email_parser.py DBS PayNow / PayLah! / GIRO email parsing
├── gmail.py        Gmail API client
├── db.py           Supabase client factory (service-role + per-user)
├── models.py       Pydantic models (the data contracts)
└── validation.py   transaction validation rules
```

The test: you can read `core/claims.py` or `core/validation.py` and understand
exactly what it does without opening a single web-framework file. That's the
point.

### `backend/` — a thin transport layer

`backend/routers/` are deliberately **thin**. A router parses the request,
delegates to `core/`, and shapes the response. It doesn't hold business rules.

```
backend/
├── main.py         FastAPI app + router wiring (local dev entry)
├── deps.py         auth dependencies (JWT → per-user DB client, AI rate limit)
├── demo_seed.py    baseline data for the public demo account
└── routers/        transactions, categories, reports, budgets, subscriptions,
                    networth, claims, statements, ingest, telegram, demo,
                    investments/
```

For example, the transactions router's `create` endpoint is essentially:
*validate → insert → return*. All the "what makes a transaction valid" logic
lives in `core/validation.py`, not here.

### `api/` — the serverless adapter

Vercel invokes serverless functions, not a long-running server. `api/` contains a
single entry point that wraps the same FastAPI app with a **Mangum** ASGI
adapter. This is why the identical app runs under Uvicorn locally *and* as a
serverless function in production — the app code doesn't change, only how it's
invoked. → [deployment](05-deployment.md)

### `frontend/` — the React SPA

```
frontend/src/
├── pages/       route-level screens: Dashboard, Spending, Report, Budget,
│                Investments, Import, Settings, Login
├── components/  reusable UI: NetWorthCard, UpcomingBills, MonthBars, Sidebar…
├── api/         HTTP layer: Axios instance + typed calls (http.js, client.js…)
├── auth/        Supabase session handling and route protection
├── lib/         pure helpers: aggregate, format, categories, claim math, logger
└── App.jsx      router + layout composition
```

Two boundaries worth calling out:

- **`api/` vs `pages/`** — components never call Axios directly. They go through
  `src/api`, where a single interceptor attaches the auth token and normalises
  errors. Swapping the backend URL or auth scheme is a one-file change.
- **`lib/`** — anything that's pure computation (summing a month's spending,
  formatting currency, computing a claim's remaining balance) lives here, away
  from React. That makes it testable on its own (`aggregate.test.js`,
  `claims.test.js`) and keeps components focused on rendering.

### `db/` — schema as versioned migrations

```
db/
├── schema.sql            base tables + constraints
└── 002_multi_tenant.sql  per-user ownership, RLS policies, AI-usage counter
```

Keeping the schema in the repo (rather than only in the Supabase dashboard) means
the database design is reviewable and reproducible. → [database](03-database-design.md)

---

**One takeaway:** the folder boundaries mirror the architecture. `core/` is the
domain, `backend/` and `api/` are transport, `frontend/` is presentation, and
`db/` is the source of truth. Each can be understood — and changed — without
having to hold the others in your head.
