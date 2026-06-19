# Modular Core Refactor — Design

**Date:** 2026-06-19
**Status:** Approved (pending implementation plan)

## Goal

Restructure the finance tracker so that:

1. **Local LLM for dev, Claude for prod** — parsing runs against Ollama during
   development/testing (no token spend) and Claude in production, selected by env var.
2. **A validation layer** guards every path that writes a transaction.
3. **The code is modular** — pure math, the HTTP backend, and the (already separate)
   frontend are cleanly split, so any one concern can be read and changed in isolation
   without loading the others.

A motivating secondary benefit of (3): reasoning about one concern (e.g. report math)
means opening one small file, not three duplicated copies embedded in HTTP plumbing.

## Context: why this is needed

The current backend logic is **triplicated**:

- `parse_transaction` + `SYSTEM_PROMPT` exist in `backend/llm_parser.py`,
  `bot/bot.py`, and `api/index.py`.
- The report math (`_month_range`, `monthly_report` aggregation) and the Pydantic
  models are duplicated between `backend/` and `api/index.py`.
- `api/index.py` is a hand-maintained clone of the entire backend, required because
  Vercel's serverless runtime needs a single entry module and `backend/` uses flat
  imports that don't resolve there.

There is no validation beyond Pydantic types. In particular the Telegram webhook path
does `supabase.table("transactions").insert(parsed)` — raw LLM output written straight
to the database with no checks.

## Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| LLM provider | Pluggable seam; **Ollama** for dev, **Claude** for prod |
| Provider selection | Explicit env var `LLM_PROVIDER`; **hard-fail** if the selected provider is unreachable (no silent fallback to Claude) |
| Unification scope | One shared `core` package; `backend/` is the single FastAPI app; `api/index.py` becomes a thin Mangum wrapper |
| Polling bot (`bot/`) | **Deleted.** Production uses the webhook; the polling bot was a duplicated local-dev tool |
| Math layout | `core/calc/` **subpackage** (concrete future features: budgets, forecasts, trends) |
| Validation | One `core/validation.py` module called by every write path |
| Unknown category | **Coerce to `null`** (Uncategorized); never block a logged transaction over a category guess |
| Frontend | **Out of scope** for restructuring — already cleanly separate |

## Architecture

Strictly one-directional dependencies: `frontend → backend (HTTP) → core`. Core never
imports backend; backend never imports `api/`.

```
finance-tracker/
├── core/                     # shared domain logic. No FastAPI, no HTTP. Importable by anything.
│   ├── models.py             #   Pydantic models — single source of truth
│   ├── db.py                 #   supabase client factory
│   ├── calc/                 #   THE MATH (pure, I/O-free, unit-testable without tokens/DB)
│   │   ├── __init__.py       #     stable public surface: re-exports month_range, monthly_summary
│   │   ├── periods.py        #     month_range() + date-window helpers
│   │   └── reports.py        #     monthly_summary(rows) — income/expense/net/breakdown
│   ├── validation.py         #   validate_raw_text(), validate_transaction() + ValidationError
│   └── parsing/
│       ├── __init__.py       #     parse_transaction(text, cats) — picks provider from env
│       ├── prompt.py         #     SYSTEM_PROMPT — single source
│       ├── extract.py        #     tolerant JSON extractor (strips ```json fences)
│       ├── claude.py         #     ClaudeProvider  (lazy-imports anthropic)
│       └── ollama.py         #     OllamaProvider  (lazy-imports ollama)
├── backend/                  # THE BACKEND: thin HTTP adapter over core. The ONLY app.
│   ├── main.py               #   FastAPI app + ValidationError→422 handler
│   └── routers/
│       ├── transactions.py
│       ├── categories.py
│       ├── reports.py        #   fetches rows, calls core.calc.monthly_summary
│       └── telegram.py       #   /webhook (moved out of api/index.py)
├── api/
│   └── index.py              # ~4 lines: sys.path shim + from backend.main import app; Mangum
├── frontend/                 # unchanged
├── tests/                    # pytest: core.calc + core.validation, zero network/DB/tokens
└── db/
    └── schema.sql            # DB-level CHECK / NOT NULL constraints
```

### Module boundaries

Each unit has one purpose, a defined interface, and is understandable in isolation:

- **`core/calc/`** — pure functions over plain dict/list data. No DB, no HTTP. Callers
  import only from `core.calc` (the `__init__` surface), never reach into submodules, so
  future `budgets.py` / `forecasts.py` / `trends.py` add files without churning callers.
- **`core/parsing/`** — turns natural-language text into a transaction dict via a
  provider. Public surface is `parse_transaction(text, categories) -> dict`.
- **`core/validation.py`** — the single chokepoint for write safety.
- **`backend/`** — HTTP shape only: routing, request/response, error mapping. Delegates
  all logic to core.
- **`api/index.py`** — serverless entry; wraps the backend app, owns no logic.

## Component details

### Parser provider abstraction

```python
# core/parsing/__init__.py
def parse_transaction(text: str, categories: list[str]) -> dict:
    provider = _get_provider()                       # env-selected, built once
    raw = provider.complete(SYSTEM_PROMPT, _build_user_msg(text, categories))
    return extract_json(raw)                          # tolerant: strips fences, then json.loads
```

- **Interface:** one method, `complete(system: str, user: str) -> str`. Neither call site
  knows which model answered.
- **Selection:** env var `LLM_PROVIDER` ∈ {`ollama`, `claude`}. Dev `.env` sets `ollama`;
  Vercel sets `claude`.
- **Hard-fail:** if the selected provider is unreachable (e.g. Ollama not running), the
  parse raises a clear error (`"Ollama unreachable at <OLLAMA_HOST>"`). No fallback to
  Claude — avoids surprise token spend in dev.
- **Lazy imports:** `claude.py` imports `anthropic`, `ollama.py` imports `ollama`, each
  *inside* its provider. Prod never imports the ollama lib; dev never requires anthropic.
- **New env vars:** `LLM_PROVIDER`, `OLLAMA_HOST` (default `http://localhost:11434`),
  `OLLAMA_MODEL` (e.g. `llama3.1`).

### Validation layer

```python
# core/validation.py
class ValidationError(Exception): ...                 # human message; backend maps → HTTP 422

def validate_raw_text(text: str) -> str               # PRE-LLM gate
def validate_transaction(data, known_categories) -> TransactionCreate   # POST-parse / API gate
```

**`validate_raw_text`** (webhook, before spending a model call): strip, reject empty,
cap length (~500 chars).

**`validate_transaction`** — single chokepoint for the webhook (after parse),
`POST /transactions`, and `PUT /transactions`. Coerces through `TransactionCreate`, then
enforces:

| Rule | Gap it closes |
|---|---|
| Coerce via `TransactionCreate` | webhook's raw `insert(parsed)` with no checks |
| `amount != 0` | meaningless zero-value rows |
| date within `[2000-01-01, today + 1 day]` | hallucinated/typo years; `api/`'s missing date validation |
| `item` non-empty, ≤ 200 chars; `remarks` ≤ 500 chars | unbounded / empty fields |
| category not in `known_categories` → set to `None` | model inventing categories |

The tolerant JSON extractor (`core/parsing/extract.py`) handles code-fenced model output
*before* validation runs.

**DB level (`db/schema.sql`):** `CHECK (amount <> 0)`, `NOT NULL` on `item` / `date` /
`amount`. Applied manually in Supabase; last line of defense.

### Deployment wiring

```python
# api/index.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))   # repo root on path
from backend.main import app
from mangum import Mangum
handler = Mangum(app, lifespan="off")
```

`backend/` becomes a proper package (`__init__.py` files) so both `uvicorn` (local) and
the Vercel function resolve `from backend.main import app` and core imports.

## Error handling

- `core` raises `ValidationError` (validation) and a provider/parse error (parsing).
- `backend/main.py` registers an exception handler mapping `ValidationError` → HTTP 422
  with the message.
- `backend/routers/telegram.py` catches `ValidationError` and parse errors → friendly
  Telegram reply (e.g. "Could not parse that…"), never a 500.

## Testing

- `tests/test_calc.py` — pure math (`month_range`, `monthly_summary`) over fixtures. No
  network, no DB, no tokens. The fast inner loop.
- `tests/test_validation.py` — each rule above, valid + invalid cases.
- `tests/test_parsing.py` — `extract_json` (fenced/plain/garbage) and `parse_transaction`
  against a **fake provider**, so parsing logic is covered without a live model.

## Risks

- **Vercel import resolution (primary risk):** the runtime treating `api/index.py` as the
  function entry and resolving `from backend.main import app` from the repo root.
  Mitigations: `sys.path` shim, `__init__.py` files, and `api/requirements.txt` listing
  the full transitive dependency set (core is now imported). Verification must include a
  real `vercel dev` / deploy smoke test, not only local uvicorn.

## Inventory of moves (for an auditable diff)

- `backend/llm_parser.py` → `core/parsing/*` (prompt, providers, extract).
- `backend/models.py` → `core/models.py`; `api/index.py` duplicate models deleted.
- `backend/database.py` → `core/db.py`.
- `_month_range` + `monthly_report` math → `core/calc/`.
- `/api/webhook` handler → `backend/routers/telegram.py`.
- `bot/` → deleted; `BACKEND_URL` removed from `.env.example`.
- New: `core/validation.py`, `core/parsing/{ollama,claude,extract,prompt}.py`, `tests/`,
  `db/schema.sql`.
- README: add Ollama setup + `LLM_PROVIDER`/`OLLAMA_*` env vars; remove the polling-bot
  section.

## Out of scope

- Frontend restructuring (already cleanly separate).
- New product features (budgets, forecasts, trends) — `core/calc/` is shaped to receive
  them later; none are built now.
- Rate limiting / abuse protection on the webhook beyond `validate_raw_text`.
