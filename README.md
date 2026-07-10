# 💸 Finance Tracker

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude-AI-D97757?style=flat&logo=anthropic&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=flat&logo=vercel&logoColor=white)
![Tests](https://img.shields.io/badge/tests-pytest%20%2B%20vitest-0A9EDC?style=flat&logo=pytest&logoColor=white)

---

## 1. Project Overview

### What is it?
**Finance Tracker** is a full-stack personal finance application that helps users
track expenses, monitor spending trends, and gain AI-powered insights into their
financial habits. You can log a transaction by simply typing *"spent 12.50 on
lunch"* — an LLM parses it into clean, categorised data — then see it roll up into
budgets, charts, net-worth trends, and shared-expense claims.

### Why I built it
The project was built to **learn end-to-end software development** — taking a
product from idea to design, frontend, backend, database, and deployment, and
owning every layer in between. The AI integration, serverless architecture, and
multi-channel ingestion were layered on top once the full-stack fundamentals were
in place.

### Who is it for
- **Individuals** who want a fast, low-friction way to record and understand their
  spending without wrestling with spreadsheets.
- **As a portfolio piece** — a demonstration of building and shipping a complete,
  real-world web application across the whole stack.

---

## 2. Screenshots

> _Screenshots live in `docs/screenshots/`. Replace the placeholders below with your own captures._

| Dashboard | Expense Tracking |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Expense Tracking](docs/screenshots/expenses.png) |
| _Net worth · upcoming bills · monthly bars_ | _Natural-language & manual entry_ |

| Claims | AI Insights | Analytics |
|---|---|---|
| ![Claims](docs/screenshots/claims.png) | ![AI feature](docs/screenshots/ai.png) | ![Analytics](docs/screenshots/analytics.png) |
| _Split & settle shared expenses_ | _AI bull/bear & statement parsing_ | _Income vs. expense · category breakdown_ |

---

## 3. Live Demo

🔗 **[Try the live demo →](https://your-app.vercel.app)** &nbsp;·&nbsp; click **"Try the demo"** on the login page — no signup required.

The public **demo account** is fully isolated from personal data via Postgres
row-level security, reseeds to a fresh baseline every night, and caps AI calls at
5/day to control cost.

> _Replace `https://your-app.vercel.app` with your deployed Vercel URL._

---

## 4. Features

- 🔐 **User authentication** — Supabase Auth with a two-account model (private
  personal + public demo), isolated per-user by Postgres row-level security.
- 💳 **Expense & income tracking** — log transactions in plain English
  (*"grabbed coffee for 4.80 yesterday"*) or manually; the LLM extracts amount,
  item, date, and category.
- 🏷️ **Category management** — 16 canonical categories plus custom add/delete.
- 🎯 **Budget overview** — per-category monthly budgets and recurring
  bill/income (subscription) tracking.
- 📊 **Charts & analytics** — net-worth card, monthly income/expense bars, and
  category-level spending breakdowns (Recharts).
- 🤝 **Split-expense claims** — record shared expenses, track what's owed, and
  settle automatically when reimbursed.
- 🧠 **AI financial insights** — structured parsing of free text and bank-statement
  PDFs, plus AI-generated bull/bear cases and news summaries on the investments tab.
- ⏰ **Scheduled background jobs** — daily cron to ingest bank-alert emails and a
  nightly cron to reset the demo account.
- 🔗 **Webhook integration** — log transactions from a Telegram bot via a
  secret-verified webhook.

---

## 5. Tech Stack

| Purpose | Technology |
|---|---|
| **Frontend** | React 18, React Router 6, Recharts 2, Vite 5, Axios |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, Uvicorn, Mangum (ASGI adapter) |
| **Database** | Supabase (PostgreSQL) with row-level security |
| **Authentication** | Supabase Auth (JWT) |
| **AI / LLM** | Anthropic Claude (production) ↔ Ollama (local dev) via a pluggable provider seam |
| **Deployment** | Vercel serverless functions + scheduled cron |
| **Integrations** | Telegram Bot API · Gmail API · Polygon.io market data |
| **Tooling & QA** | pytest, Vitest, ESLint, Ruff, GitHub Actions CI, Sentry/GlitchTip (optional) |

---

## 6. High-Level Architecture

```
   [ Telegram Bot ]   [ React SPA ]   [ Statement PDF ]   [ Gmail Alerts ]
          │                │                 │                   │
          └────────────────┴────────┬────────┴───────────────────┘
                                     ▼
                     [ FastAPI app · Vercel serverless ]
              transactions · categories · reports · budgets
              subscriptions · networth · claims · statements
                    ingest · investments · telegram
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                         ▼
   [ Supabase Postgres ]     [ LLM seam · core/ ]       [ External APIs ]
    transactions, budgets,    Claude / Ollama            Polygon.io,
    claims, subscriptions,    text/PDF/email → JSON      Gmail, Telegram
    net worth  (RLS)
```

Four entry points feed **one shared validation + persistence layer**. Business
logic lives in `core/` and is completely independent of how the data arrived —
whether typed on the web, sent from a bot, uploaded as a PDF, or read from email.

> 📖 **Want the technical deep-dive?** See [`docs/architecture/`](docs/architecture/README.md)
> for the system diagram, data flow, database design (ER + row-level security),
> the AI pipeline, deployment, observability, and the design decisions behind it all.

---

## 7. Getting Started

**Prerequisites:** Python 3.11+, Node 18+, a Supabase project, and an Anthropic API
key (or [Ollama](https://ollama.com) for a local LLM). Telegram / Gmail / Polygon
keys are optional, per feature.

```bash
# 1. Clone
git clone https://github.com/fookwahkong/finance-tracker.git
cd finance-tracker

# 2. Configure — copy the example env and fill in your values
cp .env.example .env

# 3. Backend  →  http://localhost:8000
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload

# 4. Frontend →  http://localhost:5173  (proxies /api → :8000)
cd frontend && npm install && npm run dev
```

**Database:** apply `db/schema.sql` then `db/002_multi_tenant.sql` (adds per-user
ownership + row-level security) in the Supabase SQL editor.
**Deploy:** run `vercel deploy` — `vercel.json` builds the frontend, routes
`/api/*` to the serverless function, and registers the daily email-ingest and
nightly demo-reset crons.

**Run the tests:**
```bash
pip install -r requirements-dev.txt && pytest   # backend
cd frontend && npm test                          # frontend
```

---

## 8. Future Roadmap

- **LLM confidence layer** — return a confidence score and flagged ambiguities;
  below threshold, ask a clarifying question instead of auto-saving.
- **AI financial agent** — a Claude tool-use agent that answers *"how am I doing
  this month?"* with trend and budget-burn analysis.
- **Forecasting** — recurring-expense detection, projected month-end balance, and
  what-if scenarios on the dashboard.
- **Event-driven architecture** — emit `transaction.created/updated/deleted`
  events so notifications, analytics, and forecasting become independent consumers.
- **Containerization & local-first storage** — a Docker image and a swappable
  storage backend (SQLite) for fully self-hosted, cloud-independent deployments.

---

## 9. Lessons Learned

- **Design a seam before you need one.** Putting Anthropic Claude and local Ollama
  behind a single `LLM_PROVIDER` interface meant I could develop offline and swap
  providers with zero changes to callers — a small abstraction that paid for itself.
- **Keep business logic transport-agnostic.** Isolating pure logic in `core/`
  (settlement math, validation, aggregation) made four different ingestion channels
  reuse the same rules — and made that logic trivial to unit-test without a database.
- **Serverless changes how you architect.** Adapting one FastAPI app to run both
  locally (Uvicorn) and on Vercel (Mangum) taught me about cold starts, statelessness,
  and pushing scheduled work into cron rather than long-running processes.
- **Multi-tenancy belongs in the database.** Postgres row-level security enforces
  personal/demo isolation at the source, so I don't have to remember to filter by
  user in every query — the database refuses to leak.
- **Prompt design is engineering.** Reliable structured-JSON extraction needed
  explicit date and category context in the prompt and strict validation on the way
  out — the model is a component with a contract, not magic.
