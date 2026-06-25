# Bank Statement Importer

**Date:** 2026-06-25
**Status:** Approved

## Overview

A new transaction ingestion path: the user uploads a digital DBS bank statement
PDF, the backend extracts the transaction rows and suggests a category for each,
and the user reviews/edits the rows in a table before any are saved.

This complements the existing Telegram, Apple Pay Shortcut, and Gmail paths. It
reuses the same division of labour those paths already prove: **deterministic
extraction owns the numbers, the LLM owns only the fuzzy category label.** See
`ingest_email` in `backend/routers/ingest.py:69` — the email `direction` is
authoritative for the amount's sign, and the LLM only supplies item/category.
The statement importer is the same shape, batched over many rows with a review
gate added in front of the database write.

**Input assumption:** statements are *digital, text-based* PDFs (downloaded from
online banking), which have an extractable text layer. No OCR is used. Scanned
PDFs and photos are out of scope.

---

## Architecture

```
PDF upload (frontend)
   │
   ▼
POST /api/statements/parse  (multipart file)
   │
   ├─ Stage 1: core/statement/extract.py     deterministic (pdfplumber)
   │     rows: { date, item, amount, direction }   exact money, no LLM
   │
   ├─ Stage 2: core/statement/categorize.py  ONE batched LLM call
   │     adds: { suggested_category, is_new }       LLM sees descriptions only
   │
   ▼  returns parsed rows — NOTHING saved yet
[Review & edit table] (frontend)
   │     user edits category/amount, accepts new categories, deselects rows
   ▼
POST /api/statements/import  (confirmed rows)
   │     create accepted new categories → validate → bulk insert to Supabase
   ▼
done
```

The LLM never sees or returns amounts, eliminating the one dangerous failure
mode (transposed money). The review table means stage-2 categorization does not
need to be perfect — the human corrects it before the write.

---

## New Files

| File | Purpose |
|------|---------|
| `core/statement/__init__.py` | Exposes `extract_rows` and `categorize_rows` |
| `core/statement/extract.py` | `extract_rows(pdf_bytes) -> list[dict]` — pdfplumber table extraction for the DBS layout |
| `core/statement/categorize.py` | `categorize_rows(descriptions, categories) -> list[dict]` — one batched LLM call via existing provider |
| `core/statement/prompt.py` | Batch categorization system prompt (allows proposing a new category) |
| `backend/routers/statements.py` | `POST /api/statements/parse` and `POST /api/statements/import` |
| `tests/test_statement_extract.py` | Extraction tests against a scrubbed DBS sample fixture |
| `tests/test_statement_categorize.py` | Categorization tests using a fake provider (no real model) |
| `tests/fixtures/dbs_statement_sample.txt` | Extracted-and-scrubbed DBS statement text used as a deterministic fixture |

### Changes to existing files

| File | Change |
|------|--------|
| `backend/main.py` | Register `statements` router at prefix `/api/statements` |
| `core/models.py` | Add `ParsedRow` and `ImportRequest` models |
| `frontend/src/api/client.js` | Add `parseStatement(file)` and `importStatement(rows)` |
| `frontend/src/...` | New upload control + editable preview table component |
| `requirements.txt` | Add `pdfplumber` |

---

## Stage 1 — core/statement/extract.py

Responsibilities:
- `extract_rows(pdf_bytes: bytes) -> list[dict]`
- Uses `pdfplumber` to read the DBS statement's transaction table.
- Maps the debit/credit column to a `direction` ("in" / "out"); the caller
  applies the sign, exactly like `core/email_parser.py`.
- Returns rows of `{ date: str (ISO), item: str, amount: float (positive
  magnitude), direction: "in" | "out" }`.
- Pure, deterministic, no network — directly unit-testable against a saved
  sample.
- Raises a descriptive error when no transaction table is found, so a bad upload
  is never silently dropped.

The exact column layout and row regex are determined during implementation by
inspecting a real DBS statement (same approach the email parser took).

## Stage 2 — core/statement/categorize.py

Responsibilities:
- `categorize_rows(descriptions: list[str], categories: list[str]) -> list[dict]`
- Makes **one** batched call through the existing `core.parsing._get_provider()`,
  so the Claude/Ollama switch via `LLM_PROVIDER` continues to work unchanged.
- Reuses `core.parsing.extract.extract_json`.
- Returns one entry per description: `{ category: str, is_new: bool }`. `is_new`
  is true when the LLM proposes a category not in the supplied list.
- Defensive: if the LLM returns bad or partial JSON, affected rows fall back to a
  blank/`"Others"` category rather than failing the whole request (same posture
  as `ingest.py:58`). The review table lets the user fix them.

The batch prompt lives in `core/statement/prompt.py`: given N descriptions and
the current category list, return a JSON array; a row may carry a proposed new
category, flagged so the frontend can surface it.

---

## Endpoint: POST /api/statements/parse

**Request:** multipart upload of the PDF file.

**Flow:**
1. Read the uploaded bytes.
2. `extract_rows(bytes)` → deterministic rows.
3. `categorize_rows([r.item for r in rows], known_categories)` → categories.
4. Merge: apply the sign from `direction`, attach `suggested_category` and
   `is_new`.
5. Return the rows. **Nothing is written to the database.**

**Response body:**
```json
{
  "rows": [
    {
      "date": "2026-06-12",
      "item": "FAIRPRICE FINEST",
      "amount": -23.40,
      "source": "card",
      "suggested_category": "Groceries",
      "is_new": false
    }
  ]
}
```

`source` is derived from the statement type (e.g. a credit-card statement →
`"card"`); the exact mapping is fixed during implementation.

## Endpoint: POST /api/statements/import

**Request body:** the user-confirmed rows (a subset of what `/parse` returned,
with any edits applied).

**Flow:**
1. For each row whose chosen category does not exist yet, create it in the
   `categories` table.
2. For each row, `validate_transaction(row, known_categories)` (reusing
   `core/validation.py`).
3. Bulk-insert the validated transactions into Supabase.
4. Return the count inserted.

---

## Models (core/models.py)

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

---

## Testing

- **pytest never calls a real model.** `test_statement_categorize.py` reuses the
  `_FakeProvider` + monkeypatch pattern from `tests/test_parsing.py:25`,
  returning canned JSON.
- **`test_statement_extract.py` is the highest-value test:** it asserts exact
  rows (dates and amounts) from a saved DBS sample fixture, locking the money
  math. The fixture is a real statement's extracted text with account number and
  balances scrubbed.
- **Manual dev default = Haiku.** `LLM_PROVIDER=claude`,
  `CLAUDE_MODEL=claude-haiku-4-5-20251001`. Cheap (one batched call per
  statement), reliable JSON, zero setup. `LLM_PROVIDER=ollama` remains the
  offline/zero-cost fallback — a config flip, no code change.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Scanned PDF (no text layer) | `422` — "This looks like a scanned PDF; only digital statements are supported." (OCR would slot in here later — out of scope.) |
| No transaction table found | `422` — "Couldn't find a transaction table in this statement." |
| LLM bad/partial JSON | Don't fail the import; affected rows fall back to blank/`"Others"`, user fixes in the table |
| Validation fails on import | `422` with the offending row's detail (reuses existing `ValidationError` handler) |
| Duplicate rows (nice-to-have) | Flag rows whose date+amount+item already exist so the user can deselect; may be deferred |

---

## Out of Scope

- Multiple bank layouts (DBS only)
- OCR / scanned PDFs / photos
- CSV / Excel import
- Auto-import without the review step
- Recurring-transaction detection
