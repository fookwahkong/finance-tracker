# Apple Pay + Gmail Email Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new transaction ingestion endpoints — one for iOS Apple Pay Shortcuts, one polled from Gmail bank notification emails — both auto-categorizing via the existing LLM parser before writing to Supabase.

**Architecture:** A new `backend/routers/ingest.py` router exposes `POST /api/ingest/shortcut` (static API key auth) and `POST /api/ingest/email` (Vercel cron secret auth). Both paths call `core.parsing.parse_transaction()` to categorize, then insert into Supabase. The email path delegates Gmail access to `core/gmail.py` and body extraction to `core/email_parser.py`.

**Tech Stack:** FastAPI, Supabase (existing), `google-api-python-client` + `google-auth` for Gmail API, `pytest` + `unittest.mock` for tests.

## Global Constraints

- Python 3.11+ (existing codebase constraint)
- All new code lives under `backend/` or `core/` matching existing layout
- No new abstractions beyond what is described — no base classes, no registries
- Tests mock all external I/O (Supabase, Gmail API, LLM) — no real network calls in tests
- Transactions are never silently dropped; parser failures fall back to `category: "Uncategorized"`
- `source` field set to `"shortcut"` or `"email"` on every transaction this feature creates

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `core/email_parser.py` | Extract merchant/amount/date from bank email body via regex |
| Create | `core/gmail.py` | Gmail API client: fetch unread messages, mark as read |
| Create | `backend/routers/ingest.py` | Both ingest endpoints + auth dependencies |
| Create | `tests/test_email_parser.py` | Unit tests for email_parser |
| Create | `tests/test_gmail.py` | Unit tests for gmail client (mocked API) |
| Create | `tests/test_ingest.py` | Endpoint tests via TestClient (all deps mocked) |
| Modify | `backend/requirements.txt` | Add google API packages |
| Modify | `requirements-dev.txt` | Add `google-auth-oauthlib` for OAuth setup script |
| Modify | `tests/conftest.py` | Add new env var defaults |
| Modify | `backend/main.py` | Register ingest router |
| Modify | `vercel.json` | Add cron entry |
| Modify | `tests/test_app_smoke.py` | Assert new routes are mounted |
| Create | `scripts/gmail_auth.py` | One-time local OAuth flow → prints token JSON |

---

### Task 1: Dependencies and env setup

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `requirements-dev.txt`
- Modify: `tests/conftest.py`
- Modify: `.env`

**Interfaces:**
- Produces: `google.oauth2.credentials`, `googleapiclient.discovery` importable in subsequent tasks

- [ ] **Step 1: Add Google API packages to backend/requirements.txt**

Open `backend/requirements.txt` and add three lines after the existing entries:

```
fastapi
uvicorn[standard]
supabase
anthropic
python-dotenv
pydantic
httpx
google-api-python-client
google-auth
google-auth-httplib2
```

- [ ] **Step 2: Add google-auth-oauthlib to requirements-dev.txt**

```
-r backend/requirements.txt
pytest
mangum
google-auth-oauthlib
```

- [ ] **Step 3: Install updated dependencies**

```bash
pip install -r backend/requirements.txt -r requirements-dev.txt
```

Expected: installs without error. `google-api-python-client`, `google-auth`, `google-auth-httplib2`, `google-auth-oauthlib` all present.

- [ ] **Step 4: Add new env var defaults to tests/conftest.py**

The file currently ends at line 8. Append new defaults:

```python
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("LLM_PROVIDER", "claude")
os.environ.setdefault("SHORTCUT_API_KEY", "test-shortcut-key")
os.environ.setdefault("CRON_SECRET", "test-cron-secret")
os.environ.setdefault("GMAIL_QUERY", "is:unread from:donotreply@dbs.com")
os.environ.setdefault(
    "GMAIL_CREDENTIALS",
    '{"token":"x","refresh_token":"y","client_id":"z","client_secret":"w","token_uri":"https://oauth2.googleapis.com/token","scopes":["https://www.googleapis.com/auth/gmail.modify"]}',
)
```

- [ ] **Step 5: Add new env vars to .env**

Append to your existing `.env` file:

```
SHORTCUT_API_KEY=          # fill in: openssl rand -hex 32
CRON_SECRET=               # fill in: openssl rand -hex 32
GMAIL_CREDENTIALS=         # fill in after running scripts/gmail_auth.py
GMAIL_QUERY=is:unread from:donotreply@dbs.com subject:charged
```

Generate values for the first two now:
```bash
openssl rand -hex 32   # use output for SHORTCUT_API_KEY
openssl rand -hex 32   # use output for CRON_SECRET
```

- [ ] **Step 6: Run existing tests to confirm nothing is broken**

```bash
pytest tests/ -v
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt requirements-dev.txt tests/conftest.py
git commit -m "chore: add google api deps and env defaults for ingest feature"
```

---

### Task 2: core/email_parser.py

**Files:**
- Create: `core/email_parser.py`
- Create: `tests/test_email_parser.py`

**Interfaces:**
- Produces: `parse(body: str) -> dict` where dict has keys `merchant: str`, `amount: float`, `date: str` (YYYY-MM-DD). Raises `ValueError` with a descriptive message if any field cannot be extracted.

**⚠️ Before writing code:** Open one of your bank's actual notification emails. Copy the plain-text body and verify the regex patterns below match it. Adjust `_AMOUNT_RE`, `_MERCHANT_RE`, and `_DATE_RE` if your bank uses a different format. The sample below matches DBS/POSB card alert emails.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_email_parser.py`:

```python
import pytest
from core.email_parser import parse

# Matches DBS/POSB card alert format — adjust if your bank differs.
_DBS_SAMPLE = (
    "Dear Customer,\n\n"
    "Your DBS/POSB Debit Card ending in 1234 was charged SGD 25.90 "
    "at GRABFOOD on 23 Jun 2026.\n\n"
    "If you did not authorise this transaction, please call 1800 111 1111."
)

_DBS_SAMPLE_WITH_COMMA = (
    "Your DBS/POSB Debit Card ending in 1234 was charged SGD 1,025.00 "
    "at APPLE.COM/BILL on 23 Jun 2026."
)


def test_parse_extracts_amount():
    result = parse(_DBS_SAMPLE)
    assert result["amount"] == 25.90


def test_parse_extracts_large_amount_with_comma():
    result = parse(_DBS_SAMPLE_WITH_COMMA)
    assert result["amount"] == 1025.00


def test_parse_extracts_merchant():
    result = parse(_DBS_SAMPLE)
    assert result["merchant"] == "GRABFOOD"


def test_parse_extracts_date():
    result = parse(_DBS_SAMPLE)
    assert result["date"] == "2026-06-23"


def test_parse_raises_on_unrecognised_body():
    with pytest.raises(ValueError, match="amount"):
        parse("Hello, your statement is ready.")


def test_parse_raises_with_all_missing_fields():
    with pytest.raises(ValueError) as exc_info:
        parse("completely unrelated email")
    assert "amount" in str(exc_info.value)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_email_parser.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.email_parser'`

- [ ] **Step 3: Implement core/email_parser.py**

```python
import re
from datetime import datetime

# Adjust these patterns to match your bank's email format.
# The patterns below match DBS/POSB card alert emails:
#   "was charged SGD 25.90 at GRABFOOD on 23 Jun 2026"
_AMOUNT_RE = re.compile(r'SGD\s+([\d,]+\.\d{2})')
_MERCHANT_RE = re.compile(r'at\s+(.+?)\s+on\s+\d{1,2}\s+\w')
_DATE_RE = re.compile(r'on\s+(\d{1,2}\s+\w+\s+\d{4})')


def parse(body: str) -> dict:
    amount_m = _AMOUNT_RE.search(body)
    merchant_m = _MERCHANT_RE.search(body)
    date_m = _DATE_RE.search(body)

    missing = [
        name for name, m in [("amount", amount_m), ("merchant", merchant_m), ("date", date_m)]
        if m is None
    ]
    if missing:
        raise ValueError(f"Could not extract {', '.join(missing)} from email body")

    return {
        "merchant": merchant_m.group(1).strip(),
        "amount": float(amount_m.group(1).replace(",", "")),
        "date": datetime.strptime(date_m.group(1), "%d %b %Y").date().isoformat(),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_email_parser.py -v
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/email_parser.py tests/test_email_parser.py
git commit -m "feat: email parser extracts merchant/amount/date from bank notification body"
```

---

### Task 3: core/gmail.py

**Files:**
- Create: `core/gmail.py`
- Create: `tests/test_gmail.py`

**Interfaces:**
- Produces:
  - `fetch_unread(query: str) -> list[dict]` — each dict is `{"id": str, "body": str}`
  - `mark_read(message_id: str) -> None`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_gmail.py`:

```python
import base64
import json
from unittest.mock import MagicMock, patch

import pytest
import core.gmail as gmail_module


_FAKE_CREDS_JSON = json.dumps({
    "token": "x", "refresh_token": "y", "client_id": "z",
    "client_secret": "w", "token_uri": "https://oauth2.googleapis.com/token",
    "scopes": ["https://www.googleapis.com/auth/gmail.modify"],
})


def _encoded(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode()


def _full_message(msg_id: str, text: str) -> dict:
    return {
        "id": msg_id,
        "payload": {"body": {"data": _encoded(text)}, "parts": []},
    }


def _full_message_multipart(msg_id: str, text: str) -> dict:
    return {
        "id": msg_id,
        "payload": {
            "body": {},
            "parts": [
                {"mimeType": "text/plain", "body": {"data": _encoded(text)}},
                {"mimeType": "text/html", "body": {"data": _encoded("<p>html</p>")}},
            ],
        },
    }


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_returns_decoded_bodies(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    body_text = "Your DBS card was charged SGD 10.00 at STARBUCKS on 23 Jun 2026."
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg1"}]
    }
    svc.users.return_value.messages.return_value.get.return_value.execute.return_value = (
        _full_message("msg1", body_text)
    )

    result = gmail_module.fetch_unread("is:unread")

    assert len(result) == 1
    assert result[0]["id"] == "msg1"
    assert "SGD 10.00" in result[0]["body"]


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_handles_multipart_email(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    body_text = "SGD 5.00 at KOPITIAM on 23 Jun 2026."
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg2"}]
    }
    svc.users.return_value.messages.return_value.get.return_value.execute.return_value = (
        _full_message_multipart("msg2", body_text)
    )

    result = gmail_module.fetch_unread("is:unread")
    assert "SGD 5.00" in result[0]["body"]


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_returns_empty_when_no_messages(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    result = gmail_module.fetch_unread("is:unread")
    assert result == []


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_mark_read_calls_modify_with_correct_args(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    svc = MagicMock()
    mock_build.return_value = svc

    gmail_module.mark_read("msg1")

    svc.users.return_value.messages.return_value.modify.assert_called_once_with(
        userId="me", id="msg1", body={"removeLabelIds": ["UNREAD"]}
    )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_gmail.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.gmail'`

- [ ] **Step 3: Implement core/gmail.py**

```python
import base64
import json
import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


def _service():
    creds = Credentials.from_authorized_user_info(
        json.loads(os.environ["GMAIL_CREDENTIALS"]), _SCOPES
    )
    return build("gmail", "v1", credentials=creds)


def fetch_unread(query: str) -> list[dict]:
    svc = _service()
    result = svc.users().messages().list(userId="me", q=query).execute()
    messages = result.get("messages", [])
    out = []
    for msg in messages:
        full = svc.users().messages().get(userId="me", id=msg["id"], format="full").execute()
        out.append({"id": msg["id"], "body": _extract_body(full)})
    return out


def mark_read(message_id: str) -> None:
    svc = _service()
    svc.users().messages().modify(
        userId="me", id=message_id, body={"removeLabelIds": ["UNREAD"]}
    ).execute()


def _extract_body(message: dict) -> str:
    payload = message.get("payload", {})
    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain":
            data = part["body"].get("data", "")
            return base64.urlsafe_b64decode(data + "==").decode("utf-8")
    data = payload.get("body", {}).get("data", "")
    return base64.urlsafe_b64decode(data + "==").decode("utf-8")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_gmail.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/gmail.py tests/test_gmail.py
git commit -m "feat: gmail client for fetching unread emails and marking as read"
```

---

### Task 4: backend/routers/ingest.py — both endpoints

**Files:**
- Create: `backend/routers/ingest.py`
- Create: `tests/test_ingest.py`

**Interfaces:**
- Consumes:
  - `core.db.supabase` — `.table("categories").select("name").execute().data` → `[{"name": str}]`
  - `core.db.supabase` — `.table("transactions").insert(dict).execute().data` → `[dict]`
  - `core.parsing.parse_transaction(text: str, categories: list[str]) -> dict`
  - `core.gmail.fetch_unread(query: str) -> list[{"id": str, "body": str}]`
  - `core.gmail.mark_read(message_id: str) -> None`
  - `core.email_parser.parse(body: str) -> {"merchant": str, "amount": float, "date": str}`
- Produces: `router` (FastAPI `APIRouter`) with routes `POST /shortcut` and `POST /email`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_ingest.py`:

```python
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.execute.return_value.data = [
        {"name": "Food"}, {"name": "Transport"}
    ]
    svc.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": "abc", "item": "Grab", "category": "Transport",
        "amount": -12.5, "date": "2026-06-23", "source": "shortcut", "remarks": None,
    }]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setenv("SHORTCUT_API_KEY", "test-shortcut-key")
    monkeypatch.setenv("CRON_SECRET", "test-cron-secret")
    monkeypatch.setenv("GMAIL_QUERY", "is:unread from:donotreply@dbs.com")
    monkeypatch.setattr("backend.routers.ingest.supabase", fake_supabase)
    from backend.main import app
    return TestClient(app)


# --- Shortcut endpoint ---

def test_shortcut_missing_api_key_returns_422(client):
    resp = client.post("/api/ingest/shortcut", json={"merchant": "Grab", "amount": 12.5})
    assert resp.status_code == 422


def test_shortcut_wrong_api_key_returns_401(client):
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "wrong"},
    )
    assert resp.status_code == 401


def test_shortcut_saves_parsed_transaction(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {"item": "Grab", "category": "Transport", "amount": -12.5, "date": "2026-06-23", "remarks": None},
    )
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "test-shortcut-key"},
    )
    assert resp.status_code == 201
    assert resp.json()["item"] == "Grab"
    # Verify source was set
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "shortcut"


def test_shortcut_falls_back_on_parse_failure(client, monkeypatch):
    def _fail(text, cats):
        raise ValueError("LLM error")
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", _fail)
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "test-shortcut-key"},
    )
    assert resp.status_code == 201


# --- Email endpoint ---

def test_email_wrong_cron_secret_returns_401(client):
    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401


def test_email_missing_auth_returns_422(client):
    resp = client.post("/api/ingest/email")
    assert resp.status_code == 422


def test_email_processes_one_message(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "SGD 10.00 at COFFEE on 23 Jun 2026"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {"merchant": "COFFEE", "amount": 10.0, "date": "2026-06-23"},
    )
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {"item": "Coffee", "category": "Food", "amount": -10.0, "date": "2026-06-23", "remarks": None},
    )
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "email"


def test_email_skips_unparseable_messages(client, monkeypatch):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "unrelated email content"}],
    )
    def _fail(body):
        raise ValueError("no match")
    monkeypatch.setattr("backend.routers.ingest.email_parser.parse", _fail)
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 0}


def test_email_returns_503_on_gmail_failure(client, monkeypatch):
    def _fail(q):
        raise Exception("Gmail API down")
    monkeypatch.setattr("backend.routers.ingest.gmail.fetch_unread", _fail)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 503


def test_email_falls_back_on_parse_transaction_failure(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "body"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {"merchant": "SHOP", "amount": 5.0, "date": "2026-06-23"},
    )
    def _fail(text, cats):
        raise ValueError("LLM error")
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", _fail)
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["category"] == "Uncategorized"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_ingest.py -v
```

Expected: `ImportError` or route 404s — router not registered yet.

- [ ] **Step 3: Implement backend/routers/ingest.py**

```python
import os
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

import core.email_parser as email_parser
import core.gmail as gmail
from core.db import supabase
from core.parsing import parse_transaction

router = APIRouter()


def _known_categories() -> list[str]:
    return [c["name"] for c in supabase.table("categories").select("name").execute().data]


def _verify_shortcut_key(x_api_key: str = Header(...)):
    if x_api_key != os.environ.get("SHORTCUT_API_KEY", ""):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _verify_cron_secret(authorization: str = Header(...)):
    if authorization != f"Bearer {os.environ.get('CRON_SECRET', '')}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _insert(item: str, category: str, amount: float, tx_date: str, source: str, remarks=None) -> dict:
    payload = {
        "date": tx_date,
        "item": item,
        "category": category,
        "amount": amount,
        "source": source,
        "remarks": remarks,
    }
    return supabase.table("transactions").insert(payload).execute().data[0]


class ShortcutPayload(BaseModel):
    merchant: str
    amount: float


@router.post("/shortcut", status_code=201)
def ingest_shortcut(payload: ShortcutPayload, _=Depends(_verify_shortcut_key)):
    categories = _known_categories()
    try:
        parsed = parse_transaction(f"{payload.merchant} ${payload.amount}", categories)
    except Exception:
        parsed = {}
    return _insert(
        item=parsed.get("item") or payload.merchant,
        category=parsed.get("category") or "Uncategorized",
        amount=parsed.get("amount", -abs(payload.amount)),
        tx_date=parsed.get("date") or date.today().isoformat(),
        source="shortcut",
        remarks=parsed.get("remarks"),
    )


@router.post("/email", status_code=200)
def ingest_email(_=Depends(_verify_cron_secret)):
    query = os.environ.get("GMAIL_QUERY", "")
    try:
        emails = gmail.fetch_unread(query)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gmail unavailable: {e}")

    categories = _known_categories()
    count = 0
    for msg in emails:
        try:
            parsed_email = email_parser.parse(msg["body"])
        except Exception as e:
            print(f"Skipping email {msg['id']}: {e}")
            continue

        try:
            parsed = parse_transaction(
                f"{parsed_email['merchant']} ${parsed_email['amount']}", categories
            )
        except Exception:
            parsed = {}

        _insert(
            item=parsed.get("item") or parsed_email["merchant"],
            category=parsed.get("category") or "Uncategorized",
            amount=parsed.get("amount", -abs(parsed_email["amount"])),
            tx_date=parsed_email.get("date") or date.today().isoformat(),
            source="email",
            remarks=parsed.get("remarks"),
        )
        gmail.mark_read(msg["id"])
        count += 1

    return {"processed": count}
```

- [ ] **Step 4: Register ingest router in backend/main.py**

In `backend/main.py`, update the import line (line 8):

```python
from backend.routers import transactions, categories, reports, telegram, ingest
```

Add the router registration after the telegram router line (line 34):

```python
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_ingest.py -v
```

Expected: all 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/ingest.py tests/test_ingest.py backend/main.py
git commit -m "feat: ingest router with shortcut and email endpoints"
```

---

### Task 5: Add Vercel cron and update smoke test

**Files:**
- Modify: `vercel.json`
- Modify: `tests/test_app_smoke.py`

**Interfaces:**
- Consumes: `/api/ingest/shortcut` and `/api/ingest/email` from Task 4
- Produces: cron job configured, smoke test updated

- [ ] **Step 1: Add cron entry to vercel.json**

Replace the entire content of `vercel.json`:

```json
{
  "framework": null,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ],
  "crons": [
    { "path": "/api/ingest/email", "schedule": "*/10 * * * *" }
  ]
}
```

- [ ] **Step 2: Update smoke test to assert new routes are mounted**

In `tests/test_app_smoke.py`, add two assertions to `test_api_routes_are_mounted`:

```python
def test_api_routes_are_mounted():
    paths = {route.path for route in app.routes}
    assert "/api/transactions" in paths
    assert "/api/categories" in paths
    assert "/api/reports/monthly" in paths
    assert "/api/webhook" in paths
    assert "/api/ingest/shortcut" in paths
    assert "/api/ingest/email" in paths
```

- [ ] **Step 3: Run the full test suite**

```bash
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add vercel.json tests/test_app_smoke.py
git commit -m "feat: add vercel cron for email polling, update smoke test"
```

---

### Task 6: Gmail OAuth setup script (one-time)

**Files:**
- Create: `scripts/gmail_auth.py`

This script is run once locally to generate the `GMAIL_CREDENTIALS` value. It is not called by the app and has no tests.

**Prerequisites:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable the Gmail API
3. Create OAuth 2.0 credentials → Application type: **Desktop app**
4. Download `credentials.json` and place it in the project root

- [ ] **Step 1: Create scripts/gmail_auth.py**

```python
# Run once locally to generate GMAIL_CREDENTIALS:
#   python scripts/gmail_auth.py
# Requires credentials.json in the project root (download from Google Cloud Console).
import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
creds = flow.run_local_server(port=0)

token_json = json.loads(creds.to_json())
print("\n--- GMAIL_CREDENTIALS value (paste into .env and Vercel dashboard) ---")
print(json.dumps(token_json))
```

- [ ] **Step 2: Run the script (requires credentials.json from Google Cloud Console)**

```bash
python scripts/gmail_auth.py
```

Expected: browser opens, you sign in with your Gmail account, terminal prints a JSON blob. Copy this entire JSON string (single line) and set it as `GMAIL_CREDENTIALS` in:
- Your local `.env` file
- Vercel dashboard → Settings → Environment Variables

- [ ] **Step 3: Commit the script (do not commit credentials.json)**

Verify `credentials.json` is in `.gitignore` first:
```bash
grep credentials.json .gitignore
```
If it's not there, add it: `echo "credentials.json" >> .gitignore`

```bash
git add scripts/gmail_auth.py .gitignore
git commit -m "chore: add one-time gmail oauth setup script"
```

---

## Post-implementation checklist

- [ ] `SHORTCUT_API_KEY`, `CRON_SECRET`, `GMAIL_CREDENTIALS`, `GMAIL_QUERY` are set in Vercel dashboard
- [ ] iOS Shortcut configured: trigger on Apple Pay → GET transaction details → POST to `https://<vercel-domain>/api/ingest/shortcut` with `X-API-Key` header
- [ ] Test the Shortcut manually: make a tap payment, check Supabase `transactions` table for new row with `source = 'shortcut'`
- [ ] Test the email endpoint manually: `curl -X POST https://<vercel-domain>/api/ingest/email -H "Authorization: Bearer <CRON_SECRET>"` after a bank email has arrived
- [ ] Adjust `_AMOUNT_RE`, `_MERCHANT_RE`, `_DATE_RE` in `core/email_parser.py` if regex doesn't match your bank's actual email format
