# Modular Core Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `core` package (pure math, parsing, validation, models, db), reduce the backend to a thin FastAPI app over it, make `api/index.py` a thin Vercel wrapper, add a pluggable Ollama-dev/Claude-prod parser and a validation layer on every write path, and delete the duplicated polling bot.

**Architecture:** One-directional dependencies `frontend → backend (HTTP) → core`. `core` holds all domain logic and imports no web framework. `backend/` is the single FastAPI app; `api/index.py` wraps it with Mangum for Vercel. Parsing sits behind a one-method provider seam selected by `LLM_PROVIDER`. Validation is a single module called by every path that writes a transaction.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, Supabase (supabase-py), Mangum (Vercel), httpx (Ollama + Telegram + TestClient), anthropic (Claude), pytest. Frontend unchanged (React/Vite) except one proxy-config line.

## Global Constraints

- **Provider selection:** env var `LLM_PROVIDER` ∈ {`claude`, `ollama`}; default `claude`. **Hard-fail** if the selected provider is unreachable — never fall back to Claude.
- **Lazy provider imports:** `anthropic` imported only inside `ClaudeProvider`; the Ollama provider uses `httpx` (no `ollama` library dependency). Prod never needs Ollama; dev never needs a live Claude key.
- **Unknown category policy:** `validate_transaction` coerces a category not in the known list to `None` (uniform across all paths). Never reject a transaction over a category guess.
- **Dependency direction:** `core/` must not import from `backend/` or `api/`. `backend/` must not import from `api/`.
- **URL scheme:** the single app mounts all routes under `/api` (`/api/transactions`, `/api/categories`, `/api/reports`, `/api/webhook`). The Vite dev proxy passes `/api` through unchanged.
- **Imports are package-absolute** (`from core.x import ...`, `from backend.routers import ...`). App is run as `uvicorn backend.main:app` from the repo root.
- **Validation limits (exact):** `MAX_TEXT_LEN = 500`, `MAX_ITEM_LEN = 200`, `MAX_REMARKS_LEN = 500`, `MIN_DATE = date(2000, 1, 1)`, max date = `today + 1 day`, `amount != 0`.
- Commit after every task. Run `pytest` from the repo root.

---

## File Structure

**Created:**
- `core/__init__.py`, `core/models.py`, `core/db.py`, `core/validation.py`
- `core/calc/__init__.py`, `core/calc/periods.py`, `core/calc/reports.py`
- `core/parsing/__init__.py`, `core/parsing/prompt.py`, `core/parsing/extract.py`, `core/parsing/claude.py`, `core/parsing/ollama.py`
- `backend/__init__.py`, `backend/routers/telegram.py`
- `tests/__init__.py`, `tests/conftest.py`, `tests/test_app_smoke.py`, `tests/test_calc.py`, `tests/test_parsing.py`, `tests/test_validation.py`
- `requirements-dev.txt`, `db/schema.sql`

**Modified:**
- `backend/main.py`, `backend/routers/transactions.py`, `backend/routers/categories.py`, `backend/routers/reports.py`
- `api/index.py` (collapsed to a wrapper), `api/requirements.txt`, `backend/requirements.txt`
- `frontend/vite.config.js` (drop the `/api` rewrite)
- `.env.example`, `README.md`

**Deleted:**
- `backend/models.py`, `backend/database.py`, `backend/llm_parser.py`
- `bot/` (entire directory)

---

## Task 1: Scaffold `core` (models + db) and make `backend` a package

Create the `core` package holding the shared models and db client, convert `backend` into a proper package with package-absolute imports, and stand up the pytest harness with an app smoke test. No behavior change; route prefixes stay as-is for now.

**Files:**
- Create: `core/__init__.py`, `core/models.py`, `core/db.py`, `backend/__init__.py`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_app_smoke.py`, `requirements-dev.txt`
- Modify: `backend/main.py`, `backend/routers/transactions.py`, `backend/routers/categories.py`, `backend/routers/reports.py`, `backend/requirements.txt`
- Delete: `backend/models.py`, `backend/database.py`

**Interfaces:**
- Produces: `core.models` exporting `TransactionCreate`, `TransactionUpdate`, `Transaction`, `CategoryCreate`, `Category` (unchanged from current `backend/models.py`). `core.db` exporting `supabase` (a `supabase.Client`).

- [ ] **Step 1: Create the core package and move models**

Create `core/__init__.py` (empty file).

Create `core/models.py` with the exact contents of the current `backend/models.py`:

```python
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    date: date
    item: str
    category: Optional[str] = None
    amount: float
    source: Optional[str] = None
    remarks: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    item: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None
    remarks: Optional[str] = None


class Transaction(TransactionCreate):
    id: str
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str


class Category(BaseModel):
    id: str
    name: str
    created_at: datetime
```

- [ ] **Step 2: Move the db client into core**

Create `core/db.py` with the exact contents of the current `backend/database.py` (the dotenv path goes up one level from `core/` to the repo root, same as before):

```python
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

url: str = os.environ["SUPABASE_URL"]
key: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(url, key)
```

Delete `backend/models.py` and `backend/database.py`.

- [ ] **Step 3: Make backend a package and fix imports**

Create `backend/__init__.py` (empty file).

Edit `backend/main.py` — change the router import to package-absolute:

```python
from backend.routers import transactions, categories, reports
```

(Leave the rest of `backend/main.py` unchanged, including `load_dotenv`, CORS, the `/transactions` `/categories` `/reports` prefixes, and the `/` health route.)

Edit `backend/routers/transactions.py` — replace:
```python
from database import supabase
from models import TransactionCreate, TransactionUpdate
```
with:
```python
from core.db import supabase
from core.models import TransactionCreate, TransactionUpdate
```

Edit `backend/routers/categories.py` — replace:
```python
from database import supabase
from models import CategoryCreate
```
with:
```python
from core.db import supabase
from core.models import CategoryCreate
```

Edit `backend/routers/reports.py` — replace `from database import supabase` with `from core.db import supabase`.

- [ ] **Step 4: Add dev dependencies and httpx**

Add `httpx` to `backend/requirements.txt` (needed by the FastAPI TestClient and, later, the Ollama provider and Telegram router). The file becomes:

```
fastapi
uvicorn[standard]
supabase
anthropic
python-dotenv
pydantic
httpx
```

Create `requirements-dev.txt` (`mangum` is included so the Task 5 Vercel-handler import test can run locally):

```
-r backend/requirements.txt
pytest
mangum
```

Install: `pip install -r requirements-dev.txt`

- [ ] **Step 5: Create the test harness with dummy env**

Create `tests/__init__.py` (empty file).

Create `tests/conftest.py` (sets dummy env BEFORE any app import so `core.db` and routers can be imported without real secrets):

```python
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("LLM_PROVIDER", "claude")
```

- [ ] **Step 6: Write the failing smoke test**

Create `tests/test_app_smoke.py`:

```python
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_health():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 7: Run the smoke test**

Run: `pytest tests/test_app_smoke.py -v`
Expected: PASS. (If it fails on import, the import normalization in Step 3 is wrong — fix before continuing.)

- [ ] **Step 8: Commit**

```bash
git add core/ backend/ tests/ requirements-dev.txt
git commit -m "refactor: extract core models+db, make backend a package"
```

---

## Task 2: Extract the math into `core/calc/`

Move the pure report math into a `calc` subpackage with a stable public surface, test it in isolation (no DB), and refactor the reports router to consume it.

**Files:**
- Create: `core/calc/__init__.py`, `core/calc/periods.py`, `core/calc/reports.py`, `tests/test_calc.py`
- Modify: `backend/routers/reports.py`

**Interfaces:**
- Produces: `from core.calc import month_range, monthly_summary`.
  - `month_range(month: str) -> tuple[str, str]` — returns `(start_iso, end_exclusive_iso)` for a `"YYYY-MM"` string.
  - `monthly_summary(transactions: list[dict]) -> dict` — returns `{"total_income": float, "total_expenses": float, "net": float, "breakdown": dict[str, float]}`. Does NOT include `"month"`.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_calc.py`:

```python
from core.calc import month_range, monthly_summary


def test_month_range_mid_year():
    assert month_range("2026-06") == ("2026-06-01", "2026-07-01")


def test_month_range_december_rolls_over():
    assert month_range("2026-12") == ("2026-12-01", "2027-01-01")


def test_monthly_summary_totals_and_breakdown():
    rows = [
        {"amount": 3000.0, "category": "Income"},
        {"amount": -12.5, "category": "Food"},
        {"amount": -7.5, "category": "Food"},
        {"amount": -20.0, "category": None},
    ]
    result = monthly_summary(rows)
    assert result["total_income"] == 3000.0
    assert result["total_expenses"] == -40.0
    assert result["net"] == 2960.0
    assert result["breakdown"] == {"Income": 3000.0, "Food": -20.0, "Uncategorized": -20.0}
    assert "month" not in result


def test_monthly_summary_empty():
    result = monthly_summary([])
    assert result == {"total_income": 0, "total_expenses": 0, "net": 0, "breakdown": {}}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_calc.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.calc'`.

- [ ] **Step 3: Implement the calc subpackage**

Create `core/calc/periods.py`:

```python
def month_range(month: str) -> tuple[str, str]:
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    next_mon = 1 if mon == 12 else mon + 1
    next_year = year + 1 if mon == 12 else year
    return f"{month}-01", f"{next_year}-{next_mon:02d}-01"
```

Create `core/calc/reports.py`:

```python
def monthly_summary(transactions: list[dict]) -> dict:
    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    total_expenses = sum(t["amount"] for t in transactions if t["amount"] < 0)
    breakdown: dict[str, float] = {}
    for t in transactions:
        cat = t.get("category") or "Uncategorized"
        breakdown[cat] = breakdown.get(cat, 0) + t["amount"]
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income + total_expenses,
        "breakdown": breakdown,
    }
```

Create `core/calc/__init__.py`:

```python
from .periods import month_range
from .reports import monthly_summary

__all__ = ["month_range", "monthly_summary"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_calc.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor the reports router to use core.calc**

Replace the entire contents of `backend/routers/reports.py` with:

```python
from fastapi import APIRouter, Query
from core.db import supabase
from core.calc import month_range, monthly_summary

router = APIRouter()


@router.get("/monthly")
def monthly_report(month: str = Query(..., description="YYYY-MM")):
    start, end = month_range(month)
    rows = (
        supabase.table("transactions")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .execute()
        .data
    )
    return {"month": month, **monthly_summary(rows)}
```

- [ ] **Step 6: Verify the app still imports**

Run: `pytest tests/test_app_smoke.py tests/test_calc.py -v`
Expected: PASS (smoke + 4 calc tests).

- [ ] **Step 7: Commit**

```bash
git add core/calc/ tests/test_calc.py backend/routers/reports.py
git commit -m "refactor: move report math into core.calc subpackage"
```

---

## Task 3: Extract parsing into `core/parsing/` with pluggable providers

Replace the triplicated `parse_transaction` with a provider seam: a tolerant JSON extractor, a single prompt, and Claude/Ollama providers selected by `LLM_PROVIDER` with hard-fail behavior.

**Files:**
- Create: `core/parsing/__init__.py`, `core/parsing/prompt.py`, `core/parsing/extract.py`, `core/parsing/claude.py`, `core/parsing/ollama.py`, `tests/test_parsing.py`
- Delete: `backend/llm_parser.py`

**Interfaces:**
- Produces:
  - `from core.parsing import parse_transaction` — `parse_transaction(text: str, categories: list[str]) -> dict`. Selects the provider from `LLM_PROVIDER`, calls it, returns the extracted JSON dict. Raises `ValueError` on non-JSON output; raises `RuntimeError` if the provider is unreachable.
  - `from core.parsing.extract import extract_json` — `extract_json(text: str) -> dict`, strips ```` ```json ```` / ```` ``` ```` fences then `json.loads`; raises `ValueError` on failure.
  - `from core.parsing.prompt import SYSTEM_PROMPT`.
  - Provider classes expose `complete(self, system: str, user: str) -> str`.
  - Test seam: `core.parsing._provider` module global can be set to a fake provider to bypass selection.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_parsing.py`:

```python
import pytest
import core.parsing as parsing
from core.parsing.extract import extract_json


def test_extract_plain_json():
    assert extract_json('{"item": "coffee", "amount": -4.5}') == {"item": "coffee", "amount": -4.5}


def test_extract_fenced_json():
    text = '```json\n{"item": "tea", "amount": -3}\n```'
    assert extract_json(text) == {"item": "tea", "amount": -3}


def test_extract_bare_fence():
    text = '```\n{"item": "tea", "amount": -3}\n```'
    assert extract_json(text) == {"item": "tea", "amount": -3}


def test_extract_garbage_raises():
    with pytest.raises(ValueError):
        extract_json("I could not parse that, sorry!")


class _FakeProvider:
    def __init__(self, reply):
        self._reply = reply

    def complete(self, system, user):
        return self._reply


def test_parse_transaction_uses_provider(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider('{"item": "lunch", "amount": -12.5}'))
    result = parsing.parse_transaction("lunch 12.50", ["Food"])
    assert result == {"item": "lunch", "amount": -12.5}


def test_parse_transaction_propagates_bad_json(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider("not json"))
    with pytest.raises(ValueError):
        parsing.parse_transaction("lunch", ["Food"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_parsing.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.parsing'`.

- [ ] **Step 3: Implement prompt and extractor**

Create `core/parsing/prompt.py`:

```python
SYSTEM_PROMPT = """You are a personal finance transaction parser.
Given a natural-language description of a transaction, extract the details and return ONLY a valid JSON object with these fields:
- date (string, YYYY-MM-DD — use today's date if not mentioned)
- item (string, short description of what was bought/received)
- category (string, pick the best match from the provided list, or null if none fit)
- amount (number, negative for expenses, positive for income)
- source (string, payment method if mentioned, otherwise null)
- remarks (string, any extra notes, otherwise null)

Return ONLY the raw JSON object. No markdown, no explanation."""
```

Create `core/parsing/extract.py`:

```python
import json
import re

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def extract_json(text: str) -> dict:
    text = text.strip()
    match = _FENCE.match(text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model returned non-JSON: {text}") from exc
```

- [ ] **Step 4: Implement the providers**

Create `core/parsing/claude.py`:

```python
import os


class ClaudeProvider:
    def __init__(self):
        import anthropic

        self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self._model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

    def complete(self, system: str, user: str) -> str:
        message = self._client.messages.create(
            model=self._model,
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return message.content[0].text
```

Create `core/parsing/ollama.py`:

```python
import os

import httpx


class OllamaProvider:
    def __init__(self):
        self._host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        self._model = os.environ.get("OLLAMA_MODEL", "llama3.1")

    def complete(self, system: str, user: str) -> str:
        try:
            resp = httpx.post(
                f"{self._host}/api/chat",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                    "format": "json",
                },
                timeout=60,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama unreachable at {self._host}: {exc}") from exc
        return resp.json()["message"]["content"]
```

- [ ] **Step 5: Implement provider selection and parse_transaction**

Create `core/parsing/__init__.py`:

```python
import os
from datetime import date

from .extract import extract_json
from .prompt import SYSTEM_PROMPT

_provider = None


def _get_provider():
    global _provider
    if _provider is None:
        name = os.environ.get("LLM_PROVIDER", "claude").lower()
        if name == "claude":
            from .claude import ClaudeProvider

            _provider = ClaudeProvider()
        elif name == "ollama":
            from .ollama import OllamaProvider

            _provider = OllamaProvider()
        else:
            raise ValueError(
                f"Unknown LLM_PROVIDER: {name!r} (expected 'claude' or 'ollama')"
            )
    return _provider


def _build_user_msg(text: str, categories: list[str]) -> str:
    return (
        f"Today's date: {date.today().isoformat()}\n"
        f"Available categories: {', '.join(categories)}\n\n"
        f"Transaction: {text}"
    )


def parse_transaction(text: str, categories: list[str]) -> dict:
    provider = _get_provider()
    raw = provider.complete(SYSTEM_PROMPT, _build_user_msg(text, categories))
    return extract_json(raw)
```

Delete `backend/llm_parser.py`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_parsing.py -v`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add core/parsing/ tests/test_parsing.py
git rm backend/llm_parser.py
git commit -m "feat: pluggable parser providers (claude/ollama) in core.parsing"
```

---

## Task 4: Add the validation layer and wire it into the transactions router

Create `core/validation.py`, map `ValidationError` to HTTP 422, and run every create/update through `validate_transaction`.

**Files:**
- Create: `core/validation.py`, `tests/test_validation.py`
- Modify: `backend/main.py`, `backend/routers/transactions.py`

**Interfaces:**
- Produces:
  - `from core.validation import validate_raw_text, validate_transaction, ValidationError`
  - `validate_raw_text(text: str) -> str` — strips, rejects empty / over `MAX_TEXT_LEN`; returns the cleaned text. Raises `ValidationError`.
  - `validate_transaction(data, known_categories: list[str]) -> TransactionCreate` — coerces `data` (dict or model-dump) via `TransactionCreate`, enforces the business rules, coerces unknown category → `None`, returns a validated `TransactionCreate`. Raises `ValidationError`.
- Consumes: `core.models.TransactionCreate`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_validation.py`:

```python
from datetime import date, timedelta

import pytest

from core.validation import ValidationError, validate_raw_text, validate_transaction

CATS = ["Food", "Income"]


def _base(**overrides):
    data = {"date": date.today().isoformat(), "item": "lunch", "amount": -12.5, "category": "Food"}
    data.update(overrides)
    return data


def test_validate_raw_text_strips_and_returns():
    assert validate_raw_text("  coffee 4.50  ") == "coffee 4.50"


def test_validate_raw_text_rejects_empty():
    with pytest.raises(ValidationError):
        validate_raw_text("   ")


def test_validate_raw_text_rejects_too_long():
    with pytest.raises(ValidationError):
        validate_raw_text("x" * 501)


def test_validate_transaction_happy_path():
    tx = validate_transaction(_base(), CATS)
    assert tx.item == "lunch"
    assert tx.amount == -12.5
    assert tx.category == "Food"


def test_validate_transaction_rejects_zero_amount():
    with pytest.raises(ValidationError):
        validate_transaction(_base(amount=0), CATS)


def test_validate_transaction_rejects_absurd_date():
    with pytest.raises(ValidationError):
        validate_transaction(_base(date="1999-12-31"), CATS)


def test_validate_transaction_rejects_far_future_date():
    future = (date.today() + timedelta(days=5)).isoformat()
    with pytest.raises(ValidationError):
        validate_transaction(_base(date=future), CATS)


def test_validate_transaction_rejects_empty_item():
    with pytest.raises(ValidationError):
        validate_transaction(_base(item="   "), CATS)


def test_validate_transaction_rejects_long_item():
    with pytest.raises(ValidationError):
        validate_transaction(_base(item="x" * 201), CATS)


def test_validate_transaction_coerces_unknown_category_to_none():
    tx = validate_transaction(_base(category="Crypto"), CATS)
    assert tx.category is None


def test_validate_transaction_rejects_non_numeric_amount():
    with pytest.raises(ValidationError):
        validate_transaction(_base(amount="lots"), CATS)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_validation.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.validation'`.

- [ ] **Step 3: Implement the validation module**

Create `core/validation.py`:

```python
from datetime import date, timedelta

from pydantic import ValidationError as PydanticValidationError

from core.models import TransactionCreate

MAX_TEXT_LEN = 500
MAX_ITEM_LEN = 200
MAX_REMARKS_LEN = 500
MIN_DATE = date(2000, 1, 1)


class ValidationError(Exception):
    pass


def validate_raw_text(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        raise ValidationError("Message is empty.")
    if len(cleaned) > MAX_TEXT_LEN:
        raise ValidationError(f"Message too long (max {MAX_TEXT_LEN} characters).")
    return cleaned


def validate_transaction(data, known_categories: list[str]) -> TransactionCreate:
    try:
        tx = TransactionCreate.model_validate(data)
    except PydanticValidationError as exc:
        raise ValidationError(f"Invalid transaction: {exc}") from exc

    if tx.amount == 0:
        raise ValidationError("Amount cannot be zero.")

    max_date = date.today() + timedelta(days=1)
    if tx.date < MIN_DATE or tx.date > max_date:
        raise ValidationError(f"Date {tx.date.isoformat()} is out of range.")

    item = tx.item.strip()
    if not item:
        raise ValidationError("Item is required.")
    if len(item) > MAX_ITEM_LEN:
        raise ValidationError(f"Item too long (max {MAX_ITEM_LEN} characters).")
    tx.item = item

    if tx.remarks is not None and len(tx.remarks) > MAX_REMARKS_LEN:
        raise ValidationError(f"Remarks too long (max {MAX_REMARKS_LEN} characters).")

    if tx.category is not None and tx.category not in known_categories:
        tx.category = None

    return tx
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_validation.py -v`
Expected: PASS (11 tests).

- [ ] **Step 5: Register the 422 exception handler**

Edit `backend/main.py`. Add imports near the top (after the existing FastAPI imports):

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from core.validation import ValidationError
```

After the `app = FastAPI(title="Finance Tracker API")` line (and before/after the middleware is fine), add:

```python
@app.exception_handler(ValidationError)
async def _validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})
```

- [ ] **Step 6: Wire validation into the transactions router**

Replace the entire contents of `backend/routers/transactions.py` with:

```python
from typing import Optional
from fastapi import APIRouter, HTTPException
from core.db import supabase
from core.models import TransactionCreate, TransactionUpdate
from core.validation import validate_transaction

router = APIRouter()


def _known_categories() -> list[str]:
    return [c["name"] for c in supabase.table("categories").select("name").execute().data]


@router.get("")
def list_transactions(month: Optional[str] = None):
    query = supabase.table("transactions").select("*").order("date", desc=True)
    if month:
        start = f"{month}-01"
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        next_mon = 1 if mon == 12 else mon + 1
        next_year = year + 1 if mon == 12 else year
        end = f"{next_year}-{next_mon:02d}-01"
        query = query.gte("date", start).lt("date", end)
    result = query.execute()
    return result.data


@router.post("", status_code=201)
def create_transaction(tx: TransactionCreate):
    validated = validate_transaction(tx.model_dump(), _known_categories())
    payload = validated.model_dump()
    payload["date"] = payload["date"].isoformat()
    result = supabase.table("transactions").insert(payload).execute()
    return result.data[0]


@router.put("/{tx_id}")
def update_transaction(tx_id: str, tx: TransactionUpdate):
    existing = supabase.table("transactions").select("*").eq("id", tx_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    provided = {k: v for k, v in tx.model_dump().items() if v is not None}
    merged = {**existing[0], **provided}
    validated = validate_transaction(merged, _known_categories())
    payload = {k: getattr(validated, k) for k in provided}
    if "date" in payload:
        payload["date"] = payload["date"].isoformat()
    result = supabase.table("transactions").update(payload).eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result.data[0]


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: str):
    result = supabase.table("transactions").delete().eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
```

Note: `list_transactions` keeps its inline month logic (it filters a query rather than aggregating, so it does not reuse `month_range`; leaving it avoids churn).

- [ ] **Step 7: Verify the suite still passes**

Run: `pytest -v`
Expected: PASS (smoke + calc + parsing + validation).

- [ ] **Step 8: Commit**

```bash
git add core/validation.py tests/test_validation.py backend/main.py backend/routers/transactions.py
git commit -m "feat: validation layer on transaction write paths"
```

---

## Task 5: Unify into one app — Telegram router, `/api` prefix, thin Vercel wrapper

Move the webhook into a router that uses the new parse+validate pipeline, mount every router under `/api`, collapse `api/index.py` to a Mangum wrapper around the backend app, and align the Vite proxy.

**Files:**
- Create: `backend/routers/telegram.py`
- Modify: `backend/main.py`, `api/index.py`, `api/requirements.txt`, `frontend/vite.config.js`, `tests/test_app_smoke.py`

**Interfaces:**
- Consumes: `core.parsing.parse_transaction`, `core.validation.validate_raw_text`, `core.validation.validate_transaction`, `core.validation.ValidationError`, `core.db.supabase`.
- Produces: the single FastAPI `app` (in `backend.main`) now serves `/api/transactions`, `/api/categories`, `/api/reports/monthly`, `/api/webhook`, and a root `/` health route. `api.index.handler` is the Mangum entrypoint.

- [ ] **Step 1: Create the Telegram webhook router**

Create `backend/routers/telegram.py`:

```python
import os

import httpx
from fastapi import APIRouter, Request

from core.db import supabase
from core.parsing import parse_transaction
from core.validation import ValidationError, validate_raw_text, validate_transaction

router = APIRouter()

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")


@router.post("/webhook")
async def telegram_webhook(request: Request):
    if TELEGRAM_WEBHOOK_SECRET:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token != TELEGRAM_WEBHOOK_SECRET:
            return {"ok": False}

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    message = update.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()

    if not text or not chat_id:
        return {"ok": True}

    try:
        cleaned = validate_raw_text(text)
        cats = [c["name"] for c in supabase.table("categories").select("name").execute().data]
        parsed = parse_transaction(cleaned, cats)
        validated = validate_transaction(parsed, cats)
        payload = validated.model_dump()
        payload["date"] = payload["date"].isoformat()
        tx = supabase.table("transactions").insert(payload).execute().data[0]
        sign = "+" if tx["amount"] > 0 else ""
        reply = (
            f"Recorded: {tx['item']}\n"
            f"Amount: {sign}{tx['amount']}\n"
            f"Category: {tx.get('category') or 'Uncategorized'}\n"
            f"Date: {tx['date']}"
        )
    except ValidationError as exc:
        reply = f"Could not record that: {exc}"
    except ValueError:
        reply = "Could not parse that. Try: 'Coffee 4.50 Food' or 'Salary 3000 Income'"
    except Exception as exc:
        reply = f"Error: {exc}"

    with httpx.Client() as client:
        client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": reply},
        )
    return {"ok": True}
```

- [ ] **Step 2: Re-mount all routers under `/api` and include telegram**

Replace the entire contents of `backend/main.py` with:

```python
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import transactions, categories, reports, telegram
from core.validation import ValidationError

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
async def _validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(telegram.router, prefix="/api", tags=["telegram"])


@app.get("/")
def root():
    return {"status": "ok"}
```

- [ ] **Step 3: Collapse api/index.py to a thin wrapper**

Replace the entire contents of `api/index.py` with:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum

from backend.main import app

# Vercel calls this as the serverless entry point
handler = Mangum(app, lifespan="off")
```

- [ ] **Step 4: Update api/requirements.txt**

Ensure `api/requirements.txt` contains everything `core` + `backend` transitively need on Vercel (note: `ollama` is NOT needed — the Ollama provider uses httpx and is never selected in prod):

```
fastapi
mangum
supabase
anthropic
httpx
python-dotenv
uvicorn[standard]
pydantic
```

- [ ] **Step 5: Align the Vite dev proxy**

Edit `frontend/vite.config.js` — remove the `rewrite` line so `/api` is passed through unchanged to the backend (which now serves `/api/...`). The proxy block becomes:

```javascript
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
```

- [ ] **Step 6: Update the smoke test for the new routes**

Replace the contents of `tests/test_app_smoke.py` with:

```python
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_health():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_api_routes_are_mounted():
    paths = {route.path for route in app.routes}
    assert "/api/transactions" in paths
    assert "/api/categories" in paths
    assert "/api/reports/monthly" in paths
    assert "/api/webhook" in paths


def test_vercel_handler_imports():
    import api.index

    assert api.index.handler is not None
```

- [ ] **Step 7: Run the full suite**

Run: `pytest -v`
Expected: PASS (all prior tests + the three smoke assertions). The `test_vercel_handler_imports` test confirms the `sys.path` shim and `from backend.main import app` resolve.

- [ ] **Step 8: Commit**

```bash
git add backend/ api/ frontend/vite.config.js tests/test_app_smoke.py
git commit -m "refactor: single app under /api, thin Vercel wrapper, telegram router"
```

---

## Task 6: Delete the polling bot and update config, schema, and docs

Remove the now-redundant bot, refresh env documentation, add DB constraints, and update the README.

**Files:**
- Delete: `bot/` (entire directory)
- Create: `db/schema.sql`
- Modify: `.env.example`, `README.md`

- [ ] **Step 1: Delete the polling bot**

```bash
git rm -r bot/
```

- [ ] **Step 2: Update .env.example**

Replace the contents of `.env.example` with (drops dead `BACKEND_URL`, adds provider vars):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-or-service-key
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string
ALLOWED_ORIGINS=http://localhost:5173

# LLM provider: "ollama" for local dev, "claude" for production
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

- [ ] **Step 3: Add the DB constraints file**

Create `db/schema.sql` (applied manually in the Supabase SQL editor; last line of defense):

```sql
-- Defense-in-depth constraints for the transactions table.
-- Apply in the Supabase SQL editor. Adjust the table name if different.

alter table transactions
  alter column item set not null,
  alter column date set not null,
  alter column amount set not null;

alter table transactions
  add constraint transactions_amount_nonzero check (amount <> 0);
```

- [ ] **Step 4: Update the README**

In `README.md`, make these edits:

1. Remove the "Telegram Bot (optional)" run block that references `pip install -r bot/requirements.txt` / `python bot/bot.py` (around line 272-276). Replace it with a note:

```markdown
**Telegram (local testing)**

In production Telegram is wired to the `/api/webhook` endpoint. To test it locally, expose your backend with a tunnel (e.g. `ngrok http 8000`) and register the webhook against the tunnel URL. The previous polling bot has been removed.
```

2. In the project-structure tree (around line 201-202), remove the `bot/` entry.

3. In the "Telegram Bot" behavior section (around line 145-152), replace the polling/webhook description with: the webhook handler lives at `backend/routers/telegram.py`, served at `/api/webhook`.

4. Add an "LLM provider" subsection under configuration documenting `LLM_PROVIDER` (`ollama` dev / `claude` prod, hard-fail on unreachable), `OLLAMA_HOST`, `OLLAMA_MODEL`, and that local dev needs Ollama running (`ollama serve` + `ollama pull llama3.1`).

- [ ] **Step 5: Verify the suite still passes after deletions**

Run: `pytest -v`
Expected: PASS (bot deletion does not touch importable modules under test).

- [ ] **Step 6: Commit**

```bash
git add .env.example db/schema.sql README.md
git commit -m "chore: remove polling bot, add provider env + db constraints + docs"
```

---

## Task 7: End-to-end verification (manual)

Confirm the refactor works as a running system — local app, local Ollama parse, and the Vercel entrypoint. This task has no code; it is a verification gate.

**Files:** none.

- [ ] **Step 1: Full automated suite**

Run: `pytest -v` from the repo root.
Expected: all tests PASS.

- [ ] **Step 2: Boot the backend locally**

Run: `uvicorn backend.main:app --reload`
In another shell: `curl http://localhost:8000/` → expect `{"status":"ok"}`.
`curl http://localhost:8000/api/categories` → expect a JSON array (requires real Supabase env in `.env`).

- [ ] **Step 3: Local Ollama parse smoke**

Ensure `LLM_PROVIDER=ollama` in `.env`, Ollama is running (`ollama serve`) and the model is pulled (`ollama pull llama3.1`). Exercise a parse path (e.g. POST a Telegram-shaped payload to `http://localhost:8000/api/webhook`, or add a temporary script calling `core.parsing.parse_transaction("coffee 4.50", ["Food"])`). Expect a parsed dict, no Claude call.

Then stop Ollama and repeat: expect a clear `RuntimeError: Ollama unreachable at ...` (hard-fail, no Claude fallback).

- [ ] **Step 4: Frontend against the unified backend**

Run `npm run dev` in `frontend/`, open http://localhost:5173, confirm transactions/categories/reports load (proxy now passes `/api` through unchanged).

- [ ] **Step 5: Vercel entrypoint**

Run `vercel dev` (or deploy to a preview). Hit `/api/categories` and `/api/transactions` on the Vercel URL. Confirm the serverless function resolves `from backend.main import app` (this is the primary deployment risk called out in the spec). If imports fail, verify `api/requirements.txt` lists all deps and the `sys.path` shim points at the repo root.

- [ ] **Step 6: Finalize**

If all green, the branch is ready for review/merge. If `vercel dev` reveals import issues, fix `api/index.py` / `api/requirements.txt` and re-run Steps 1-5.

---

## Notes for the implementer

- **Run all `pytest` and `uvicorn` commands from the repo root** so package-absolute imports resolve.
- **`core` never imports `backend` or `api`.** If you find yourself adding such an import, the logic belongs in `core`, not the other way around.
- **Providers lazy-import their SDKs.** Do not add module-level `import anthropic` / `import ollama`; keep `anthropic` inside `ClaudeProvider.__init__` and use `httpx` for Ollama.
- The fake-provider test seam is `core.parsing._provider`; set it via `monkeypatch.setattr` in tests so no live model is contacted.
