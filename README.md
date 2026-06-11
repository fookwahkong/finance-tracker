# Finance Tracker

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude-Sonnet-D97757?style=flat&logo=anthropic&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)

A personal finance tracker with AI-powered natural language transaction entry. Log transactions by typing plain text — "spent 12.50 on lunch today" — and the app parses, categorises, and stores them automatically. Accessible via a React web dashboard or a Telegram bot for on-the-go logging.

---

## Features

- **NLP transaction entry** — type free text, Claude parses it into structured data
- **Telegram bot** — log transactions from your phone without opening a browser
- **Dashboard** — monthly income/expense summary, spending pie chart, recent transactions
- **Monthly reports** — category-level income and expense bar chart
- **Category management** — create and delete custom spending categories
- **Full transaction CRUD** — inline edit and delete from the web UI

---

## Architecture

```
[Telegram Bot]     [React Frontend]     [REST API Clients]
      │                   │                     │
      └───────────────────┼─────────────────────┘
                          ▼
             [FastAPI / Vercel Serverless]
              ┌────────────────────────┐
              │   Transactions Router  │  /api/transactions
              │   Categories Router    │  /api/categories
              │   Reports Router       │  /api/reports/monthly
              │   Webhook Handler      │  /api/webhook
              └───────────┬────────────┘
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
  [Supabase PostgreSQL]         [Anthropic Claude]
   transactions table            llm_parser.py
   categories table              NLP text → JSON
```

**Three entry points share the same API layer:**

- **React frontend** — browser-based dashboard served from `frontend/dist`
- **Telegram bot** — either polling (local) or webhook via Vercel serverless
- **Direct API** — any HTTP client can call the REST endpoints

**Two external services:**

- **Supabase** — managed PostgreSQL for all persistent data
- **Anthropic Claude** — parses unstructured transaction text into structured JSON

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Recharts 2, Vite 5 |
| Backend | Python, FastAPI, Uvicorn |
| Serverless deployment | Vercel (Mangum ASGI adapter) |
| Database | Supabase (PostgreSQL) |
| LLM | Anthropic Claude Sonnet (`claude-sonnet-4-6`) |
| Telegram bot | python-telegram-bot ≥ 20 |
| HTTP clients | Axios (frontend), httpx (bot) |
| Data validation | Pydantic v2 |

---

## How It Works

### NLP Transaction Parsing

The core feature is `backend/llm_parser.py`. When a user submits free text — whether from the web form or Telegram — it is sent to Claude with:

- A system prompt defining the expected JSON output schema
- Today's date (so relative terms like "yesterday" resolve correctly)
- The user's available category list (so Claude picks from real categories, not invented ones)
- The raw transaction text

Claude returns a raw JSON object with no markdown wrapping:

```json
{
  "date": "2025-06-11",
  "item": "Lunch",
  "category": "Food",
  "amount": -12.50,
  "source": null,
  "remarks": null
}
```

**Amount convention:** negative values are expenses, positive values are income. If parsing fails or the response is malformed, a `ValueError` is raised and the transaction is rejected.

### Transaction Flow

```
User input (text or form)
  │
  ▼
llm_parser.parse_transaction(raw_text, categories)
  │
  ▼
POST /api/transactions  →  Pydantic validation  →  Supabase insert
  │
  ▼
Response: created transaction object with id and timestamp
```

### API Endpoints

#### Transactions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions` | List transactions; optional `?month=YYYY-MM` filter |
| `POST` | `/api/transactions` | Create a transaction |
| `PUT` | `/api/transactions/{id}` | Partial update (null fields are ignored) |
| `DELETE` | `/api/transactions/{id}` | Delete a transaction |

#### Categories
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/categories` | List all categories (alphabetical) |
| `POST` | `/api/categories` | Create a category |
| `DELETE` | `/api/categories/{id}` | Delete a category |

#### Reports
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/monthly` | Monthly summary; required `?month=YYYY-MM` |

Returns: `total_income`, `total_expenses`, `net`, `breakdown` (category → amount).

#### Webhook
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhook` | Telegram webhook handler (Vercel deployment) |

### Telegram Bot

In local development the bot runs in polling mode (`python bot/bot.py`). On Vercel, Telegram is configured to POST updates to `/api/webhook`. Either way:

1. User sends any text message to the bot
2. Bot calls `llm_parser` with the message text
3. Parsed transaction is inserted into Supabase
4. Bot replies with a confirmation showing the parsed fields

### Database Schema

**`transactions`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `date` | date | Transaction date |
| `item` | text | Short description |
| `category` | text | Nullable; must match a category name |
| `amount` | numeric | Negative = expense, positive = income |
| `source` | text | Nullable; payment method |
| `remarks` | text | Nullable; additional context |
| `created_at` | timestamp | Server timestamp |

**`categories`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `name` | text | Unique category name |
| `created_at` | timestamp | Server timestamp |

---

## Project Structure

```
finance-tracker/
├── .env                        # Local environment variables (not committed)
├── .env.example                # Template — copy to .env and fill in values
├── .gitignore
├── vercel.json                 # Vercel build and rewrite config
│
├── backend/                    # Local development server
│   ├── main.py                 # FastAPI app entry point
│   ├── database.py             # Supabase client initialisation
│   ├── models.py               # Pydantic request/response models
│   ├── llm_parser.py           # Claude NLP → JSON parser
│   ├── requirements.txt
│   └── routers/
│       ├── transactions.py
│       ├── categories.py
│       └── reports.py
│
├── api/                        # Vercel serverless entry point
│   ├── index.py                # Consolidated FastAPI app (all routers + webhook)
│   └── requirements.txt
│
├── bot/                        # Telegram bot (polling mode)
│   ├── bot.py
│   └── requirements.txt
│
└── frontend/                   # React web app
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             # Root router (/, /dashboard, /transactions, /report, /settings)
        ├── api/
        │   └── client.js       # Axios API client
        ├── components/
        │   ├── Navbar.jsx
        │   ├── SpendingChart.jsx   # Recharts pie chart
        │   └── TransactionTable.jsx # Inline-editable table
        └── pages/
            ├── Dashboard.jsx   # Summary cards + chart + recent transactions
            ├── Transactions.jsx # Full list + add form
            ├── Report.jsx      # Monthly bar chart + analysis
            └── Settings.jsx    # Category CRUD
```

---

## Setup & Running

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project with `transactions` and `categories` tables
- An [Anthropic API key](https://console.anthropic.com)
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (only required if using the bot)

### Environment Variables

Copy `.env.example` to `.env` inside `finance-tracker/` and fill in the values:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase service role or anon key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string used to authenticate Telegram webhook requests (see below) |
| `BACKEND_URL` | Base URL of the backend (e.g. `http://localhost:8000`) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://your-app.vercel.app`) |

The frontend reads `VITE_BACKEND_URL` from `frontend/.env` (optional; defaults to relative `/api` which Vite proxies to the backend in development).

### Running Locally

**Backend**
```bash
cd finance-tracker
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
# Runs on http://localhost:8000
```

**Frontend**
```bash
cd finance-tracker/frontend
npm install
npm run dev
# Runs on http://localhost:5173
# /api requests are proxied to localhost:8000
```

**Telegram Bot** (optional)
```bash
cd finance-tracker
pip install -r bot/requirements.txt
python bot/bot.py
```

### Deploying to Vercel

```bash
cd finance-tracker
vercel deploy
```

Vercel uses `vercel.json` to:
- Build the frontend: `cd frontend && npm install && npm run build`
- Serve `frontend/dist` as static files
- Route all `/api/*` requests to `api/index.py` as a serverless function

After deploying, set a random secret string in `TELEGRAM_WEBHOOK_SECRET` (Vercel env var), then register your webhook including that secret:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Telegram will include `X-Telegram-Bot-Api-Secret-Token: <secret>` on every request; the server rejects anything that doesn't match.

---

## Future Roadmap

### LLM Confidence & Validation Layer

**Current gap:** The parser always returns a result, even when the input is ambiguous. There is no signal about how certain Claude is, so low-quality parses can silently enter the database.

**Proposed:**
- Extend the Claude response schema to include two additional fields: `confidence` (0.0–1.0) and `ambiguities` (list of field names that were unclear)
- Apply a threshold: if `confidence < 0.8`, do not auto-save
- **Bot flow:** low-confidence parse → bot asks a targeted clarifying question ("Did you mean Food or Dining Out?") → user replies → re-parse with additional context appended
- **Web flow:** surface an inline warning banner with field-level highlights before the user saves; let them correct or confirm
- **Fallback:** fields flagged in `ambiguities` are stored as `null` until the user explicitly confirms them

This creates a feedback loop where ambiguous inputs are caught at the boundary rather than silently polluting the dataset.

---

### Event-Driven Architecture

**Current gap:** All operations are synchronous request/response. There is no async processing pipeline, no audit trail of state changes, and adding a new side-effect (e.g. a notification on large transactions) requires modifying the core API.

**Proposed:** Introduce an event bus — candidates are [Vercel Queues](https://vercel.com/docs/queues) (already on the platform) or Supabase Realtime pub/sub.

Events emitted by the API layer:
- `transaction.created`
- `transaction.updated`
- `transaction.deleted`
- `report.generated`

Consumers subscribing to these events:
- **Notification service** — Telegram monthly summary, spending alerts
- **Analytics aggregator** — materialised view of category totals for fast report queries
- **Forecast engine** — re-runs forecast model whenever new data arrives

Benefits: the Telegram bot no longer writes directly to the database — it fires an event and any number of consumers can react. Adding new behaviour requires only a new consumer, not changes to the core API.

---

### AI Financial Agent

**Current gap:** The app records and displays data but offers no actionable insight. Users must interpret the charts themselves.

**Proposed:** A Claude tool-use agent that can be invoked on demand (via Telegram command or a web "Ask" panel) or run on a schedule (e.g. monthly summary on the 1st).

The agent is given a set of tools:

| Tool | Description |
|---|---|
| `get_transactions(month)` | Fetch all transactions for a given month |
| `get_monthly_report(month)` | Fetch aggregated income/expense/net |
| `compare_periods(month_a, month_b)` | Diff two months by category |

The agent decides which tools to call to answer queries like "How am I doing this month?" and produces structured analysis:

- Unusual spending spikes vs. a rolling 3-month average
- Category-level trends ("Food spend is up 23% vs. last quarter")
- Budget burn rate against user-defined category limits
- A plain-English month-end "state of finances" summary delivered via Telegram

---

### Personal Finance Forecasting

**Current gap:** The app is entirely backward-looking. There is no way to see what is coming or model the impact of spending changes.

**Proposed:** Time-series forecasting layered on top of transaction history.

**Recurring expense detection:**
- Pattern-match transactions by item name and amount across months to identify subscriptions, rent, and utilities
- Detected recurrences are surfaced as a "committed expenses" list

**Projected month-end balance:**
- Sum confirmed recurrences + current month spend vs. average income → estimated end-of-month net

**What-if scenarios:**
- User inputs a hypothetical change ("reduce dining by 20%") → app shows the projected monthly saving and running total over 12 months

**Visualisation:**
- Dashboard chart gains a dashed forecast line beyond today's date with a shaded confidence band
- The AI financial agent narrates the forecast in plain English when asked

**Implementation path:** start with simple linear regression per category for baseline forecasting; ARIMA for categories with stronger seasonality (e.g. utilities). Feed forecast outputs to the financial agent as an additional tool so it can reference projections when answering questions.
