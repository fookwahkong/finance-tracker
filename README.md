uvicorn backend.main:app --reload

cd frontend
npm run dev

# 💸 Finance Tracker

> **Log a transaction by just typing "spent 12.50 on lunch" — AI does the rest.**
> A full-stack personal finance app that ingests your spending from natural language, your phone, your bank statements, and even your inbox — then turns it into budgets, reports, net-worth trends, and investment data.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude-AI-D97757?style=flat&logo=anthropic&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=flat&logo=vercel&logoColor=white)
![Tests](https://img.shields.io/badge/tests-pytest-0A9EDC?style=flat&logo=pytest&logoColor=white)

---

## 🎯 TL;DR

A personal-finance tracker where **four different inputs all flow through one AI-powered pipeline**: type plain English, message a Telegram bot, upload a bank statement PDF, or let it parse your bank's email alerts automatically. Everything lands in a clean dashboard with budgets, spending breakdowns, recurring-bill tracking, net-worth projection, and live market data.

Built with a **React + FastAPI** stack, deployed **serverless on Vercel**, backed by **Supabase Postgres**, and powered by a **pluggable LLM layer** that swaps between Anthropic Claude (prod) and local Ollama (dev) behind one interface.

---

## 🎓 Why I built this — learning end-to-end development

This is a **hands-on project to learn end-to-end development**: taking a product from idea → design → frontend → backend → database → deployment, and owning every layer in between. The AI integration, serverless architecture, and multi-channel ingestion are **supplements** — extras layered on top of the core full-stack fundamentals once they were in place.

Because it's a learning project, **not every stage of a production end-to-end lifecycle is implemented yet**. Rather than hide the gaps, they're listed below as placeholders — they're on the path I'm still working through.

| End-to-end stage | Status |
|---|---|
| Planning & requirements | ✅ Done |
| UI / UX design (wireframes, design system) | 🚧 Placeholder — built UI directly, no formal design pass yet |
| Frontend (React SPA) | ✅ Done |
| Backend / REST API (FastAPI) | ✅ Done |
| Database design (Postgres schema + constraints) | ✅ Done |
| Authentication & user accounts | ✅ Supabase Auth — personal + shared demo account, Postgres RLS isolation |
| Automated testing | ✅ Backend (pytest) · 🚧 Placeholder — no frontend / end-to-end UI tests |
| Code quality (lint, formatting, type checks) | 🚧 Placeholder — no enforced linter/formatter config yet |
| CI/CD pipeline | 🚧 Placeholder — no automated build/test/deploy pipeline yet |
| Containerization (Docker) | 🚧 Placeholder — not containerized |
| Deployment | ✅ Done — serverless on Vercel + scheduled cron |
| Security | ✅ Partial — webhook secret, API-key gating, CORS allow-list, DB constraints |
| Monitoring & observability (logging, error tracking, alerts) | 🚧 Placeholder — no structured monitoring yet |
| Documentation | ✅ Done — this README |

> **Supplements beyond core end-to-end:** AI/LLM integration, a pluggable provider seam, serverless deployment, and four independent ingestion channels.

---

## 🔐 Two-account model

This is a single-tenant app with exactly two accounts: **personal** (yours, private) and **demo** (public, shared). Hit "Try the demo" on the login page to sign in as the demo account instantly — no signup needed. Postgres row-level security keeps every table isolated per account, so demo visitors never see personal data and vice versa. Demo data resets to a fresh seeded baseline every night via a cron job, and AI-powered features (statement parsing, bull/bear analysis, news summaries) are capped at 5 calls/day on the demo account to control cost; the personal account is unlimited.

---

## 📸 Screenshots

> _Drop in dashboard / spending / report screenshots here._

| Dashboard | Spending | Reports |
|---|---|---|
| _net worth · upcoming bills · monthly bars_ | _category breakdown_ | _income vs. expense_ |

---

## ✨ Highlights

- 🧠 **Natural-language entry** — "_grabbed coffee for 4.80 yesterday_" is parsed into structured, categorised data by an LLM.
- 🤖 **Telegram bot** — log transactions from your phone via a secure webhook, no app to open.
- 📄 **AI bank-statement import** — upload a DBS PDF; the app extracts every line and auto-suggests a category for each.
- 📧 **Automatic email ingestion** — a scheduled job reads DBS PayNow / PayLah! / GIRO alert emails from Gmail and logs them with zero manual entry.
- 📊 **Dashboard & reports** — net-worth card, upcoming bills, monthly income/expense bars, and category-level spending charts (Recharts).
- 🎯 **Budgets & subscriptions** — per-category monthly budgets and recurring bill/income tracking.
- 📈 **Net-worth tracking** — cash anchors plus cumulative cash-flow to trace balance month over month.
- 💹 **Investments** — live ticker, price, dividend, and moving-average data via Polygon.io.

---

## 🛠️ What this project demonstrates

| Skill | Where it shows up |
|---|---|
| **LLM/AI integration** | Structured JSON extraction from free text, PDFs, and emails; prompt design with date + category context |
| **Clean architecture** | A pluggable provider seam (`LLM_PROVIDER`) swaps Claude ↔ Ollama with no caller changes; `core/` business logic decoupled from API/transport |
| **Full-stack delivery** | React SPA (Vite, React Router, Recharts) + FastAPI REST backend + Postgres schema design |
| **Serverless deployment** | Single FastAPI app served both locally (Uvicorn) and on Vercel via a Mangum ASGI adapter, with scheduled cron jobs |
| **Multi-channel ingestion** | Four independent entry points (web, bot, file upload, email cron) sharing one validation + persistence layer |
| **Security-minded** | Webhook secret verification, API-key-gated ingestion endpoints, CORS allow-listing, DB-level constraints |
| **Testing discipline** | A `pytest` suite covering parsing, validation, statement extraction, and every router (17 test modules) |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Recharts 2, Vite 5, Axios |
| Backend | Python 3.11, FastAPI, Uvicorn, Pydantic v2 |
| Deployment | Vercel serverless (Mangum ASGI adapter) + cron |
| Database | Supabase (PostgreSQL) |
| LLM | Anthropic Claude (prod) ↔ Ollama (local dev) via one interface |
| Integrations | Telegram Bot API · Gmail API · Polygon.io market data |
| Tooling | pytest, httpx |

---

## 🏗️ Architecture

```
[Telegram Bot]   [React SPA]   [Statement PDF]   [Gmail Alerts]   [iOS Shortcut]
       │              │              │                 │                │
       └──────────────┴──────────────┴────────┬────────┴────────────────┘
                                               ▼
                          [ FastAPI app · Vercel serverless ]
                          transactions · categories · reports
                          budgets · subscriptions · net worth
                          statements · ingest · investments · telegram
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                       ▼                      ▼
               [ Supabase Postgres ]   [ LLM seam (core/) ]   [ External APIs ]
                transactions, budgets,   Claude / Ollama        Polygon.io,
                subscriptions, networth  text/PDF/email → JSON   Gmail, Telegram
```

Four entry points, one shared validation + persistence layer. Business logic lives in `core/` and is independent of how the data arrived.

---

<details>
<summary><b>📦 Project structure</b></summary>

```
finance-tracker/
├── api/                  # Vercel serverless entry point (Mangum-wrapped FastAPI)
├── backend/
│   ├── main.py           # FastAPI app + router wiring (local dev)
│   └── routers/          # transactions, categories, reports, budgets,
│                         # subscriptions, networth, statements, ingest,
│                         # telegram, investments
├── core/                 # Transport-agnostic business logic
│   ├── parsing/          # LLM seam: claude.py, ollama.py, prompt, extract
│   ├── statement/        # Bank-statement PDF extraction + categorisation
│   ├── investments/      # Polygon.io client + cache
│   ├── calc/             # Report aggregation + period helpers
│   ├── email_parser.py   # DBS PayNow / PayLah! / GIRO email parsing
│   ├── gmail.py          # Gmail API client
│   ├── db.py             # Supabase client
│   ├── models.py         # Pydantic models
│   └── validation.py     # Transaction validation
├── frontend/             # React + Vite SPA
│   └── src/
│       ├── pages/        # Dashboard, Spending, Report, Budget,
│       │                 # Investments, Import, Settings
│       ├── components/   # NetWorthCard, UpcomingBills, MonthBars, Sidebar…
│       └── lib/          # categories, aggregate, format helpers
├── db/schema.sql         # Postgres schema + constraints
├── tests/                # pytest suite (17 modules)
└── vercel.json           # Build, rewrites, and cron config
```
</details>

<details>
<summary><b>🔌 API reference</b></summary>

All routes are prefixed with `/api`.

| Group | Endpoints |
|---|---|
| **Transactions** | `GET/POST /transactions`, `PUT/DELETE /transactions/{id}` (optional `?month=YYYY-MM`) |
| **Categories** | `GET/POST /categories`, `DELETE /categories/{id}` |
| **Reports** | `GET /reports/monthly?month=YYYY-MM` → income, expenses, net, per-category breakdown |
| **Budgets** | `GET/POST/DELETE /budgets` — one recurring monthly budget per category |
| **Subscriptions** | `GET/POST/DELETE /subscriptions` — recurring bills & income |
| **Net worth** | `GET/POST /networth` — monthly cash anchors |
| **Statements** | `POST /statements/parse` — upload a PDF, get extracted + categorised rows |
| **Ingest** | `POST /ingest/*` — email/shortcut ingestion (API-key / cron-secret gated) |
| **Investments** | `GET /investments/market/*` — ticker, prev close, aggregates, dividends, SMA |
| **Telegram** | `POST /webhook` — bot webhook (secret-token verified) |

**Amount convention:** negative = expense, positive = income. Invalid parses are rejected, never silently stored.
</details>

<details>
<summary><b>🗄️ Database schema</b></summary>

- **`transactions`** — `id`, `date`, `time`, `item`, `category`, `amount`, `source`, `created_at` (`amount <> 0`, non-null item/date/amount)
- **`categories`** — 16 canonical categories (Groceries, Food & Drink, Transport, …)
- **`budgets`** — one recurring monthly amount per category
- **`subscriptions`** — recurring `bill` / `income` items with `day_of_month`
- **`net_worth`** — one user-entered cash balance per month; later months traced from the nearest anchor + cumulative net flow

Full DDL in [`db/schema.sql`](db/schema.sql).
</details>

<details>
<summary><b>🚀 Setup & running</b></summary>

**Prerequisites:** Python 3.11+, Node 18+, a Supabase project, and an Anthropic API key (or Ollama for local LLM). Telegram / Gmail / Polygon keys are optional per feature.

**1. Environment** — copy `.env.example` to `.env` and fill in values:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | Database |
| `LLM_PROVIDER` | `claude` (prod) or `ollama` (local) |
| `ANTHROPIC_API_KEY` | Claude (when `LLM_PROVIDER=claude`) |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Local LLM (when `LLM_PROVIDER=ollama`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | Telegram bot |
| `GMAIL_CREDENTIALS` / `GMAIL_QUERY` | Email ingestion |
| `SHORTCUT_API_KEY` / `CRON_SECRET` | Ingest auth |
| `POLYGON_API_KEY` | Investments |
| `ALLOWED_ORIGINS` | CORS allow-list |

**2. Backend**
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload      # http://localhost:8000
```

**3. Frontend**
```bash
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api → :8000)
```

**4. Deploy** — `vercel deploy`. `vercel.json` builds the frontend, serves `frontend/dist`, routes `/api/*` to the serverless function, and registers the daily email-ingest cron.
</details>

<details>
<summary><b>🧪 Tests</b></summary>

```bash
pip install -r requirements-dev.txt
pytest
```

17 test modules covering NLP parsing, validation, statement extraction & categorisation, email parsing, the Polygon client, and every API router.
</details>

---

## Observability
Logging, health checks, and optional error tracking are documented in
[docs/observability.md](docs/observability.md). Nothing is sent externally
unless you set `SENTRY_DSN` / `VITE_SENTRY_DSN`.

---

## 🗺️ Roadmap

- **LLM confidence layer** — return a confidence score + flagged ambiguities; below threshold, ask a clarifying question instead of auto-saving.
- **Event-driven architecture** — emit `transaction.created/updated/deleted` events to a queue so notifications, analytics, and forecasting become independent consumers.
- **AI financial agent** — a Claude tool-use agent that answers "how am I doing this month?" with trend and budget-burn analysis.
- **Forecasting** — recurring-expense detection, projected month-end balance, and what-if scenarios visualised on the dashboard.
