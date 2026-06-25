# Bank Statement Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a digital DBS/POSB savings-account PDF statement, parse it into transactions, review/edit them in a table, and import the chosen rows.

**Architecture:** Two deterministic stages plus a review gate. Stage 1 (`core/statement/extract.py`) reads the PDF text with `pdfplumber` and produces exact rows — date, amount, direction, source — using the running **Balance** column to decide direction and to checksum every amount. Stage 2 (`core/statement/categorize.py`) makes ONE batched LLM call that turns the messy multi-line descriptions into a clean `item` + `category` (the LLM never sees amounts). A FastAPI router exposes `/parse` (returns rows, saves nothing) and `/import` (writes confirmed rows). The frontend shows an editable preview table.

**Tech Stack:** Python, FastAPI, pdfplumber, Pydantic, Supabase, pytest; React (Vite) + axios frontend. LLM via the existing `core.parsing` provider (Claude/Ollama switch).

## Global Constraints

- Statements are **digital text-based PDFs** only. No OCR. A PDF with no text layer must be rejected with a clear message.
- The LLM **never** receives or returns monetary amounts. Amounts, dates, direction, and source are 100% deterministic.
- Every extracted amount is validated against the balance delta (`|balanceₙ − balanceₙ₋₁| == amount`); a mismatch raises rather than producing silent bad data.
- `source` values must be one of the existing set: `cash`, `paynow`, `paylah`, `card`, `giro` (or `null`). Categories snap through the existing `validate_transaction` (`core/validation.py`).
- pytest **never** calls a real model. Use the `_FakeProvider` + `monkeypatch` pattern from `tests/test_parsing.py`.
- Dev default model: `LLM_PROVIDER=claude`, `CLAUDE_MODEL=claude-haiku-4-5-20251001`.
- Date format in this statement is `DD/MM/YYYY`; stored/output dates are ISO `YYYY-MM-DD`.

---

## Statement layout reference (from the real sample)

The transaction pages have this repeating structure once `pdfplumber` linearizes them:

```
ePOSBkids Account Account No. 273-10639-1          <- page header (skip)
Date Description Withdrawal (-) Deposit (+) Balance (SGD)   <- column header (skip)
Balance Brought Forward 28,087.62                  <- opening/resync balance
01/05/2026 FAST Payment / Receipt                  <- DATE line: date + type
INCOMING PAYNOW REF 5425794                         <- detail lines...
FROM: CHUA WEN LI DANA
PAYNOW TRANSFER
OTHER
350.00 28,437.62                                    <- AMOUNT + BALANCE (block end)
02/05/2026 Debit Card transaction
OTTIE PANCAKES SINGAPORE SGP 29APR
5264-7110-1081-0259
000002370679534
2.40 29,447.72
...
31/05/2026 Interest Earned 1.01 20,265.83          <- single-line variant
Balance Carried Forward 29,427.92                  <- page footer (skip, one number)
Total Balance Carried Forward: 9,628.75 1,806.96 20,265.83   <- grand total (skip, three numbers)
```

**Key facts that drive the parser:**
- The **Withdrawal** and **Deposit** columns collapse in text — a row's money line is always `<amount> <balance>` regardless of direction. **Direction is decided by the balance delta**, not text position.
- Most transactions span multiple lines and end on a `<amount> <balance>` line. **`Interest Earned`** is the only single-line variant (date, text, amount, balance all on one line).
- `Balance Brought Forward` (one number) appears at the top of every transaction page and resyncs the running balance.
- `Balance Carried Forward` (one number) and `Total Balance Carried Forward:` (three numbers) are summaries to skip.
- `source` is derivable from the transaction-type line: `Debit Card transaction`→`card`; description containing `PAYLAH`→`paylah`; containing `PAYNOW`→`paynow`; `FAST Collection`/`D2P`/`GIRO`→`giro`; otherwise `null`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `core/statement/__init__.py` | Re-export `extract_rows`, `categorize_rows` |
| `core/statement/extract.py` | Deterministic PDF→rows (regex + balance-delta + checksum + source) |
| `core/statement/prompt.py` | Batch categorization system prompt |
| `core/statement/categorize.py` | One batched LLM call → `[{item, category, is_new}]` |
| `backend/routers/statements.py` | `POST /api/statements/parse`, `POST /api/statements/import` |
| `tests/fixtures/dbs_statement_lines.py` | Scrubbed, self-consistent sample lines for extraction tests |
| `tests/test_statement_extract.py` | Asserts exact extracted rows |
| `tests/test_statement_categorize.py` | Categorization mapping via fake provider |
| `tests/test_statements_router.py` | `/parse` glue (sign + merge) via TestClient |
| `frontend/src/api/client.js` | `parseStatement(file)`, `importStatement(rows)` |
| `frontend/src/pages/Import.jsx` | Upload + editable preview table |
| `backend/main.py` | Register the `statements` router |
| `backend/requirements.txt`, `api/requirements.txt` | Add `pdfplumber` |
| `core/models.py` | `ParsedRow`, `ImportRequest` |
| `frontend/src/App.jsx`, `frontend/src/components/Sidebar.jsx` | Route + nav entry |

---

### Task 1: Stage 1 — deterministic PDF extraction

**Files:**
- Create: `core/statement/__init__.py`
- Create: `core/statement/extract.py`
- Create: `tests/fixtures/__init__.py` (empty, if not present)
- Create: `tests/fixtures/dbs_statement_lines.py`
- Test: `tests/test_statement_extract.py`
- Modify: `backend/requirements.txt`, `api/requirements.txt` (add `pdfplumber`)

**Interfaces:**
- Produces: `extract_rows(pdf_bytes: bytes) -> list[dict]` and internal `_parse_lines(lines: list[str]) -> list[dict]`. Each row dict: `{"date": str (ISO), "description": str, "amount": float (positive magnitude), "direction": "in"|"out", "source": str|None}`.

- [ ] **Step 1: Add the dependency**

Add a line `pdfplumber` to both `backend/requirements.txt` and `api/requirements.txt`. Then install into your dev environment:

Run: `pip install pdfplumber`
Expected: installs successfully (pulls in `pdfminer.six`).

- [ ] **Step 2: Create the test fixture**

This is a scrubbed, internally **balance-consistent** slice covering every branch: incoming PayNow (in), debit card (out), PayLah top-up (out), GIRO collection (out), and the single-line Interest Earned (in). Account number is faked. Balances chain exactly so the checksum passes.

Create `tests/fixtures/__init__.py` (empty file).

Create `tests/fixtures/dbs_statement_lines.py`:

```python
# Scrubbed slice of a real POSB savings statement, as pdfplumber linearizes it.
# Balances chain exactly: every |delta| equals the stated amount.
SAMPLE_LINES = [
    "ePOSBkids Account Account No. 999-99999-9",
    "Date Description Withdrawal (-) Deposit (+) Balance (SGD)",
    "Balance Brought Forward 28,087.62 ",
    "01/05/2026 FAST Payment / Receipt",
    "INCOMING PAYNOW REF 5425794",
    "FROM: CHUA WEN LI DANA",
    "PAYNOW TRANSFER",
    "OTHER",
    "350.00 28,437.62 ",
    "02/05/2026 Debit Card transaction",
    "OTTIE PANCAKES SINGAPORE SGP 29APR",
    "5264-7110-1081-0259",
    "000002370679534",
    "2.40 28,435.22 ",
    "03/05/2026 Funds Transfer",
    "TOP-UP TO PAYLAH! :",
    "FOOK WAH",
    "PLPE4612306185333634",
    "8.90 28,426.32 ",
    "12/05/2026 FAST Collection",
    "019E1B85A96C791497254FED14048B85",
    "SGA12056JKC3VE9S",
    "COLLECTION PAYMENT",
    "129.34 28,296.98 ",
    "31/05/2026 Interest Earned 1.01 28,297.99 ",
    "Balance Carried Forward 28,297.99 ",
    "Total Balance Carried Forward: 140.64 351.01 28,297.99 ",
]
```

- [ ] **Step 3: Write the failing test**

Create `tests/test_statement_extract.py`:

```python
from core.statement.extract import _parse_lines
from tests.fixtures.dbs_statement_lines import SAMPLE_LINES


def test_parses_all_five_transactions():
    rows = _parse_lines(SAMPLE_LINES)
    assert len(rows) == 5


def test_incoming_paynow_row():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[0]
    assert r["date"] == "2026-05-01"
    assert r["amount"] == 350.00
    assert r["direction"] == "in"
    assert r["source"] == "paynow"
    assert r["description"].startswith("FAST Payment / Receipt")
    assert "CHUA WEN LI DANA" in r["description"]


def test_debit_card_row_is_out_and_card():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[1]
    assert r["date"] == "2026-05-02"
    assert r["amount"] == 2.40
    assert r["direction"] == "out"
    assert r["source"] == "card"


def test_paylah_topup_source():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[2]["source"] == "paylah"
    assert rows[2]["direction"] == "out"


def test_giro_collection_source():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[3]["source"] == "giro"
    assert rows[3]["amount"] == 129.34


def test_inline_interest_earned():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[4]
    assert r["date"] == "2026-05-31"
    assert r["amount"] == 1.01
    assert r["direction"] == "in"
    assert r["source"] is None
    assert r["description"] == "Interest Earned"


def test_checksum_failure_raises():
    bad = [
        "Balance Brought Forward 100.00 ",
        "01/05/2026 Debit Card transaction",
        "SOMETHING SGP",
        "5.00 90.00 ",   # delta is 10.00 but amount says 5.00
    ]
    import pytest
    with pytest.raises(ValueError):
        _parse_lines(bad)
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `python -m pytest tests/test_statement_extract.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.statement'`.

- [ ] **Step 5: Implement the extractor**

Create `core/statement/extract.py`:

```python
import io
import re
from datetime import datetime

_MONEY = r"[\d,]+\.\d{2}"
_DATE_LINE = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(.*)$")
_AMOUNT_BALANCE = re.compile(rf"^({_MONEY})\s+({_MONEY})\s*$")
_INLINE = re.compile(rf"^(\d{{2}}/\d{{2}}/\d{{4}})\s+(.*?)\s+({_MONEY})\s+({_MONEY})\s*$")
_BROUGHT_FORWARD = re.compile(rf"^Balance Brought Forward\s+({_MONEY})\s*$")


def _money(text: str) -> float:
    return float(text.replace(",", ""))


def _source(dtype: str, blob: str) -> str | None:
    t = dtype.upper()
    b = blob.upper()
    if t.startswith("DEBIT CARD"):
        return "card"
    if "PAYLAH" in b:
        return "paylah"
    if "PAYNOW" in b:
        return "paynow"
    if t.startswith("FAST COLLECTION") or t.startswith("D2P") or "GIRO" in b:
        return "giro"
    return None


def _build(date_str, dtype, detail_lines, amt, bal, prev_balance):
    amount = _money(amt)
    balance = _money(bal)
    delta = round(balance - prev_balance, 2)
    if abs(abs(delta) - amount) > 0.01:
        raise ValueError(
            f"Checksum failed at {date_str} {dtype!r}: "
            f"balance delta {delta} != stated amount {amount}"
        )
    iso = datetime.strptime(date_str, "%d/%m/%Y").date().isoformat()
    description = "\n".join([dtype, *detail_lines]).strip()
    blob = " ".join([dtype, *detail_lines])
    return {
        "date": iso,
        "description": description,
        "amount": amount,
        "direction": "in" if delta > 0 else "out",
        "source": _source(dtype, blob),
    }, balance


def _parse_lines(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    prev_balance: float | None = None
    cur: dict | None = None  # {"date", "type", "detail": [...]}

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        bf = _BROUGHT_FORWARD.match(line)
        if bf:
            prev_balance = _money(bf.group(1))
            cur = None
            continue

        if prev_balance is not None:
            inline = _INLINE.match(line)
            if inline:
                date_str, dtype, amt, bal = inline.groups()
                row, prev_balance = _build(date_str, dtype.strip(), [], amt, bal, prev_balance)
                rows.append(row)
                cur = None
                continue

            start = _DATE_LINE.match(line)
            if start:
                cur = {"date": start.group(1), "type": start.group(2).strip(), "detail": []}
                continue

        if cur is not None:
            ab = _AMOUNT_BALANCE.match(line)
            if ab:
                amt, bal = ab.groups()
                row, prev_balance = _build(
                    cur["date"], cur["type"], cur["detail"], amt, bal, prev_balance
                )
                rows.append(row)
                cur = None
            else:
                cur["detail"].append(line)

    return rows


def extract_rows(pdf_bytes: bytes) -> list[dict]:
    import pdfplumber

    lines: list[str] = []
    any_text = False
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                any_text = True
            lines.extend(text.split("\n"))

    if not any_text:
        raise ValueError("This looks like a scanned PDF; only digital statements are supported.")

    return _parse_lines(lines)
```

Create `core/statement/__init__.py`:

```python
from .extract import extract_rows

__all__ = ["extract_rows"]
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_statement_extract.py -v`
Expected: PASS (7 tests).

- [ ] **Step 7: Sanity-check against the real PDF (manual, optional but recommended)**

Run:
```bash
python -c "from core.statement.extract import extract_rows; rows=extract_rows(open('Statement.pdf','rb').read()); print(len(rows)); [print(r) for r in rows[:3]]"
```
Expected: prints a count around 120 and the first few rows with correct dates/amounts/sources and no checksum error. (If a checksum error fires, the message names the offending row — inspect that line in the PDF.)

- [ ] **Step 8: Commit**

```bash
git add core/statement/__init__.py core/statement/extract.py tests/fixtures/__init__.py tests/fixtures/dbs_statement_lines.py tests/test_statement_extract.py backend/requirements.txt api/requirements.txt
git commit -m "feat: deterministic DBS statement extraction (stage 1)"
```

---

### Task 2: Stage 2 — batched LLM categorization

**Files:**
- Create: `core/statement/prompt.py`
- Create: `core/statement/categorize.py`
- Modify: `core/statement/__init__.py` (add export)
- Test: `tests/test_statement_categorize.py`

**Interfaces:**
- Consumes: `core.parsing._get_provider()` and `core.parsing.extract.extract_json` (existing).
- Produces: `categorize_rows(descriptions: list[str], categories: list[str]) -> list[dict]`. Each dict: `{"item": str, "category": str|None, "is_new": bool}`, one per input description, in order. `is_new` is computed in Python (`category not in categories`), never trusted from the model.

- [ ] **Step 1: Write the batch prompt**

Create `core/statement/prompt.py`:

```python
BATCH_SYSTEM_PROMPT = """You are a personal finance statement categorizer.
You receive a numbered list of bank-statement transaction descriptions and a list of existing categories.

For EACH description, in the same order, produce:
- item: a short, clean merchant or payee name (e.g. "Ottie Pancakes", "PayLah Top-up", "Salary", "Interest").
- category: the best-fitting category. Prefer an existing category from the provided list. Only if none fit, propose a concise NEW category name (1-2 words, Title Case).

Return ONLY a JSON object of this exact shape, with one entry per input description, in order:
{"rows": [{"item": "...", "category": "..."}, ...]}
No markdown, no commentary."""
```

- [ ] **Step 2: Write the failing test**

Create `tests/test_statement_categorize.py`:

```python
import core.parsing as parsing
from core.statement.categorize import categorize_rows


class _FakeProvider:
    def __init__(self, reply):
        self._reply = reply

    def complete(self, system, user):
        return self._reply


def test_maps_items_and_marks_new_category(monkeypatch):
    reply = (
        '{"rows": ['
        '{"item": "Ottie Pancakes", "category": "Food"},'
        '{"item": "PayLah Top-up", "category": "Transfers"}'
        ']}'
    )
    monkeypatch.setattr(parsing, "_provider", _FakeProvider(reply))
    out = categorize_rows(
        ["Debit Card transaction\nOTTIE PANCAKES", "Funds Transfer\nTOP-UP TO PAYLAH! :"],
        ["Food"],
    )
    assert out[0] == {"item": "Ottie Pancakes", "category": "Food", "is_new": False}
    assert out[1] == {"item": "PayLah Top-up", "category": "Transfers", "is_new": True}


def test_bad_json_falls_back_per_row(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider("sorry, not json"))
    out = categorize_rows(["Debit Card transaction\nOTTIE PANCAKES"], ["Food"])
    assert out[0]["category"] is None
    assert out[0]["is_new"] is False
    assert out[0]["item"] == "Debit Card transaction"


def test_empty_input_skips_model(monkeypatch):
    def _boom():
        raise AssertionError("provider should not be called for empty input")
    monkeypatch.setattr(parsing, "_get_provider", _boom)
    assert categorize_rows([], ["Food"]) == []
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python -m pytest tests/test_statement_categorize.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.statement.categorize'`.

- [ ] **Step 4: Implement the categorizer**

Create `core/statement/categorize.py`:

```python
from core.parsing import _get_provider
from core.parsing.extract import extract_json
from .prompt import BATCH_SYSTEM_PROMPT


def _build_user(descriptions: list[str], categories: list[str]) -> str:
    numbered = "\n".join(f"{i + 1}. {d}" for i, d in enumerate(descriptions))
    return (
        f"Existing categories: {', '.join(categories)}\n\n"
        f"Descriptions:\n{numbered}"
    )


def categorize_rows(descriptions: list[str], categories: list[str]) -> list[dict]:
    if not descriptions:
        return []

    provider = _get_provider()
    raw = provider.complete(BATCH_SYSTEM_PROMPT, _build_user(descriptions, categories))

    try:
        results = extract_json(raw).get("rows", [])
    except (ValueError, AttributeError):
        results = []

    out: list[dict] = []
    for i, desc in enumerate(descriptions):
        result = results[i] if i < len(results) else {}
        category = result.get("category") or None
        out.append({
            "item": result.get("item") or desc.split("\n")[0],
            "category": category,
            "is_new": bool(category) and category not in categories,
        })
    return out
```

Update `core/statement/__init__.py`:

```python
from .extract import extract_rows
from .categorize import categorize_rows

__all__ = ["extract_rows", "categorize_rows"]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest tests/test_statement_categorize.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add core/statement/prompt.py core/statement/categorize.py core/statement/__init__.py tests/test_statement_categorize.py
git commit -m "feat: batched LLM categorization for statement rows (stage 2)"
```

---

### Task 3: Models + backend router

**Files:**
- Modify: `core/models.py` (append `ParsedRow`, `ImportRequest`)
- Create: `backend/routers/statements.py`
- Modify: `backend/main.py` (import + register router)
- Test: `tests/test_statements_router.py`

**Interfaces:**
- Consumes: `extract_rows`, `categorize_rows` (Tasks 1-2); `validate_transaction`, `ValidationError` (`core/validation.py`); `supabase` (`core/db.py`).
- Produces: `POST /api/statements/parse` → `{"rows": [{date, item, amount (signed), source, suggested_category, is_new}]}`; `POST /api/statements/import` → `{"inserted": int}`.

- [ ] **Step 1: Add the Pydantic models**

Append to `core/models.py`:

```python
class ParsedRow(BaseModel):
    date: Date
    item: str
    amount: float
    source: Optional[str] = None
    category: Optional[str] = None


class ImportRequest(BaseModel):
    rows: list[ParsedRow]
```

- [ ] **Step 2: Write the failing router test**

This monkeypatches the two stage functions and the category lookup, so it exercises only the route's glue (signing + merge) — no PDF, no LLM, no Supabase.

Create `tests/test_statements_router.py`:

```python
from fastapi.testclient import TestClient

import backend.routers.statements as statements
from backend.main import app

client = TestClient(app)


def test_parse_applies_sign_and_merges(monkeypatch):
    monkeypatch.setattr(statements, "_known_categories", lambda: ["Food"])
    monkeypatch.setattr(statements, "extract_rows", lambda data: [
        {"date": "2026-05-02", "description": "Debit Card transaction\nOTTIE",
         "amount": 2.40, "direction": "out", "source": "card"},
        {"date": "2026-05-01", "description": "FAST Payment / Receipt\nPAYNOW",
         "amount": 350.00, "direction": "in", "source": "paynow"},
    ])
    monkeypatch.setattr(statements, "categorize_rows", lambda descs, cats: [
        {"item": "Ottie Pancakes", "category": "Food", "is_new": False},
        {"item": "Salary", "category": "Income", "is_new": True},
    ])

    resp = client.post("/api/statements/parse", files={"file": ("s.pdf", b"%PDF-fake", "application/pdf")})
    assert resp.status_code == 200
    rows = resp.json()["rows"]
    assert rows[0]["amount"] == -2.40          # 'out' -> negative
    assert rows[0]["item"] == "Ottie Pancakes"
    assert rows[0]["source"] == "card"
    assert rows[1]["amount"] == 350.00         # 'in' -> positive
    assert rows[1]["is_new"] is True


def test_parse_rejects_empty(monkeypatch):
    monkeypatch.setattr(statements, "_known_categories", lambda: [])
    monkeypatch.setattr(statements, "extract_rows", lambda data: [])
    monkeypatch.setattr(statements, "categorize_rows", lambda descs, cats: [])
    resp = client.post("/api/statements/parse", files={"file": ("s.pdf", b"x", "application/pdf")})
    assert resp.status_code == 422
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python -m pytest tests/test_statements_router.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.routers.statements'`.

- [ ] **Step 4: Implement the router**

Create `backend/routers/statements.py`:

```python
from fastapi import APIRouter, File, HTTPException, UploadFile

from core.db import supabase
from core.models import ImportRequest
from core.statement import categorize_rows, extract_rows
from core.validation import ValidationError, validate_transaction

router = APIRouter()


def _known_categories() -> list[str]:
    return [c["name"] for c in supabase.table("categories").select("name").execute().data]


@router.post("/parse")
async def parse_statement(file: UploadFile = File(...)):
    data = await file.read()
    try:
        rows = extract_rows(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not rows:
        raise HTTPException(
            status_code=422,
            detail="Couldn't find a transaction table in this statement.",
        )

    categories = _known_categories()
    cats = categorize_rows([r["description"] for r in rows], categories)

    out = []
    for row, cat in zip(rows, cats):
        magnitude = abs(row["amount"])
        amount = magnitude if row["direction"] == "in" else -magnitude
        out.append({
            "date": row["date"],
            "item": cat["item"],
            "amount": amount,
            "source": row["source"],
            "suggested_category": cat["category"],
            "is_new": cat["is_new"],
        })
    return {"rows": out}


@router.post("/import")
def import_statement(req: ImportRequest):
    known = _known_categories()
    inserted = 0
    for row in req.rows:
        if row.category and row.category not in known:
            supabase.table("categories").insert({"name": row.category}).execute()
            known.append(row.category)
        try:
            validated = validate_transaction(row.model_dump(), known)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        payload = validated.model_dump()
        payload["date"] = payload["date"].isoformat()
        supabase.table("transactions").insert(payload).execute()
        inserted += 1
    return {"inserted": inserted}
```

- [ ] **Step 5: Register the router**

In `backend/main.py`, add `statements` to the existing routers import (line 8):

```python
from backend.routers import transactions, categories, reports, telegram, ingest, statements
```

And add this line after the `ingest` registration (after line 35):

```python
app.include_router(statements.router, prefix="/api/statements", tags=["statements"])
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_statements_router.py -v`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the whole suite**

Run: `python -m pytest -q`
Expected: all tests pass (existing + the new statement tests).

- [ ] **Step 8: Commit**

```bash
git add core/models.py backend/routers/statements.py backend/main.py tests/test_statements_router.py
git commit -m "feat: statement parse/import API endpoints"
```

---

### Task 4: Frontend — API client + Import page

**Files:**
- Modify: `frontend/src/api/client.js` (add two methods)
- Create: `frontend/src/pages/Import.jsx`
- Modify: `frontend/src/App.jsx` (route)
- Modify: `frontend/src/components/Sidebar.jsx` (nav entry)

**Interfaces:**
- Consumes: `POST /api/statements/parse` (multipart) and `POST /api/statements/import` (JSON `{rows}`) from Task 3, plus existing `getCategories`.
- Produces: a `/import` page in the SPA.

- [ ] **Step 1: Add API client methods**

Append to `frontend/src/api/client.js` (after the Reports section):

```javascript
// Statement import
export const parseStatement = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/statements/parse", form).then((r) => r.data);
};

export const importStatement = (rows) =>
  api.post("/api/statements/import", { rows }).then((r) => r.data);
```

- [ ] **Step 2: Create the Import page**

Create `frontend/src/pages/Import.jsx`:

```jsx
import { useEffect, useState } from "react";
import { parseStatement, importStatement, getCategories } from "../api/client";

export default function Import() {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setError(""); setDone("");
    try {
      const data = await parseStatement(file);
      setRows(data.rows.map((r) => ({
        ...r,
        category: r.suggested_category || "",
        include: true,
      })));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to parse statement.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  function update(i, field, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function onImport() {
    setBusy(true); setError(""); setDone("");
    const payload = rows
      .filter((r) => r.include)
      .map(({ date, item, amount, source, category }) => ({
        date, item, amount, source, category: category || null,
      }));
    try {
      const res = await importStatement(payload);
      setDone(`Imported ${res.inserted} transactions.`);
      setRows([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const knownNames = new Set(categories.map((c) => c.name));

  return (
    <div className="page">
      <h1>Import Statement</h1>
      <p>Upload a digital DBS/POSB PDF statement to extract transactions.</p>

      <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} />
      {busy && <p>Working…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {done && <p style={{ color: "green" }}>{done}</p>}

      {rows.length > 0 && (
        <>
          <table className="import-table">
            <thead>
              <tr>
                <th>Include</th><th>Date</th><th>Item</th>
                <th>Amount</th><th>Source</th><th>Category</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input type="checkbox" checked={r.include}
                      onChange={(e) => update(i, "include", e.target.checked)} />
                  </td>
                  <td>{r.date}</td>
                  <td>
                    <input value={r.item} onChange={(e) => update(i, "item", e.target.value)} />
                  </td>
                  <td style={{ color: r.amount < 0 ? "crimson" : "green" }}>
                    {r.amount.toFixed(2)}
                  </td>
                  <td>{r.source || "—"}</td>
                  <td>
                    <input list="cat-options" value={r.category}
                      onChange={(e) => update(i, "category", e.target.value)} />
                    {r.category && !knownNames.has(r.category) && (
                      <span className="new-cat-tag"> NEW</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="cat-options">
            {categories.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
          <button onClick={onImport} disabled={busy}>
            Import {rows.filter((r) => r.include).length} selected
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the route**

In `frontend/src/App.jsx`, add the import near the other page imports:

```jsx
import Import from "./pages/Import";
```

And add this route inside `<Route element={<Layout />}>`, alongside the others:

```jsx
<Route path="/import" element={<Import />} />
```

- [ ] **Step 4: Add the sidebar entry**

In `frontend/src/components/Sidebar.jsx`, add to the `main` array (after the `spending` entry):

```javascript
{ to: "/import", label: "Import", icon: "↥" },
```

- [ ] **Step 5: Verify the frontend builds and runs**

Run: `cd frontend && npm run dev`
Expected: dev server starts with no build errors. Open the app, click **Import** in the sidebar, and confirm the page renders with a file input.

- [ ] **Step 6: End-to-end manual check**

With the backend running, on the `/import` page upload `Statement.pdf`. Expected: a table of ~120 rows appears with dates, signed amounts (red negative / green positive), sources, and suggested categories (some marked **NEW**). Deselect a couple, edit a category, click **Import**, and confirm the success message and that the rows appear in the Spending page.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/client.js frontend/src/pages/Import.jsx frontend/src/App.jsx frontend/src/components/Sidebar.jsx
git commit -m "feat: statement import page"
```

---

## Self-Review

**Spec coverage:**
- Digital PDF, no OCR → Task 1 `extract_rows` rejects empty-text PDFs (Global Constraints + scanned message). ✓
- Two-stage pipeline, LLM never touches amounts → Tasks 1 (amounts) and 2 (categories) are separate; router applies sign deterministically. ✓
- Balance-delta direction + checksum → Task 1 `_build`. ✓
- Deterministic source → Task 1 `_source`. ✓
- LLM proposes new categories → Task 2 `is_new`; Task 3 `/import` creates them; Task 4 surfaces **NEW** tag. ✓
- Preview & edit table → Task 4 `Import.jsx`. ✓
- Mock in pytest, Haiku for dev → Task 2 tests use `_FakeProvider`; model noted in Global Constraints. ✓
- Error handling (scanned, no rows, bad JSON, validation) → Tasks 1, 2, 3. ✓
- Endpoints `/parse` (no save) and `/import` → Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `extract_rows`→row dict keys (`date/description/amount/direction/source`) are consumed unchanged by the router and the categorizer; `categorize_rows`→`{item, category, is_new}` consumed by the router; `/parse` response keys consumed by `Import.jsx`. ✓

---

## Notes for the implementer

- **Stage 1 is the load-bearing task.** Its fixture-based tests lock the money math; do not weaken them. The `Statement.pdf` sanity check (Task 1 Step 7) is the truest test — run it.
- If the real PDF trips the checksum on some row type not in the fixture, the error message names the row. Add that row's lines to the fixture, assert the correct expected output, then adjust `_parse_lines` — never loosen the checksum to make it pass.
- `Import.jsx` uses minimal inline styling; match it to the app's existing CSS (see `Spending.jsx`) if you want it to look native. Functionality first.
