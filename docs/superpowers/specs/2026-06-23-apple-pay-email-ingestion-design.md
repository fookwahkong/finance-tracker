# Apple Pay Shortcut + Gmail Email Ingestion

**Date:** 2026-06-23  
**Status:** Approved

## Overview

Two new transaction ingestion paths added to the existing FastAPI backend on Vercel. These complement the existing Telegram input without changing any existing code.

| Source | Payment method | Trigger |
|--------|---------------|---------|
| Apple Pay Shortcut | Card tap / paywave | iOS Shortcut fires on Apple Pay transaction |
| Gmail email | QR code / online banking transfer | Vercel Cron polls Gmail every 10 minutes |

Both paths feed into the existing `core.parsing` categorizer and write to Supabase via the existing transaction logic.

---

## Architecture

```
Apple Pay Shortcut
  → POST /api/ingest/shortcut  (X-API-Key header)
  → verify key → build TransactionCreate → categorize → Supabase

Vercel Cron (*/10 * * * *)
  → POST /api/ingest/email  (Authorization: Bearer <CRON_SECRET>)
  → Gmail API fetch unread bank emails
  → parse body → build TransactionCreate → categorize → Supabase
  → mark email as read
```

No deduplication is needed between the two paths — they cover mutually exclusive payment methods.

---

## New Files

| File | Purpose |
|------|---------|
| `backend/routers/ingest.py` | Both `/api/ingest/shortcut` and `/api/ingest/email` endpoints |
| `core/gmail.py` | Gmail API client: fetch unread, mark read |
| `core/email_parser.py` | Extract merchant/amount/date from bank email body |

### Changes to existing files

| File | Change |
|------|--------|
| `backend/main.py` | Register `ingest` router at prefix `/api/ingest` |
| `vercel.json` | Add cron entry `{"path": "/api/ingest/email", "schedule": "*/10 * * * *"}` |
| `.env` | Add `SHORTCUT_API_KEY`, `CRON_SECRET`, `GMAIL_CREDENTIALS` |

---

## Endpoint: POST /api/ingest/shortcut

**Auth:** `X-API-Key` header checked against `SHORTCUT_API_KEY` env var. Returns `401` if missing or wrong.

**Request body:**
```json
{
  "name": "Ivan Kong",
  "merchant": "McDonald's",
  "amount": 12.50
}
```

**Flow:**
1. Verify API key via FastAPI dependency
2. Build `TransactionCreate` payload with today's date, source fields
3. Run through `core.parsing` categorizer → assign category
4. If categorization fails, fall back to `"Uncategorized"` (never drop the transaction)
5. Insert into Supabase

**iOS Shortcut configuration (one-time setup):**
- Trigger: "When Apple Pay transaction completes"
- Action: "Get details of Apple Pay transaction" → save `name`, `merchant`, `amount` as variables
- Action: "Get Contents of URL"
  - Method: POST
  - URL: `https://<your-vercel-domain>/api/ingest/shortcut`
  - Headers: `X-API-Key: <SHORTCUT_API_KEY>`, `Content-Type: application/json`
  - Body: JSON with the three variables

**Generating the API key:**
```bash
openssl rand -hex 32
```
Store the output in `.env` as `SHORTCUT_API_KEY` and in the Vercel dashboard environment variables. Paste the same value into the Shortcut header.

---

## Endpoint: POST /api/ingest/email

**Auth:** `Authorization: Bearer <CRON_SECRET>` — Vercel sends this automatically for cron jobs. Returns `401` if missing or wrong.

**Flow:**
1. Verify cron secret
2. Call `core.gmail.fetch_unread(query)` with bank sender + subject filter
3. For each email:
   a. Call `core.email_parser.parse(body)` → `{ merchant, amount, date }`
   b. Run through `core.parsing` categorizer
   c. Fall back to `"Uncategorized"` if categorization fails
   d. Insert into Supabase
   e. Call `core.gmail.mark_read(message_id)`
4. Return count of transactions processed

---

## core/gmail.py

Responsibilities:
- OAuth2 authentication using token stored in `GMAIL_CREDENTIALS` env var (JSON string)
- `fetch_unread(query: str) -> list[dict]` — returns list of `{ id, body }` for matching unread emails
- `mark_read(message_id: str)` — removes the `UNREAD` label from the email

**Gmail search query example:**
```
from:donotreply@dbs.com subject:"transaction" is:unread
```
The exact query is configured via a `GMAIL_QUERY` env var so it can be adjusted per bank without code changes.

**Gmail OAuth setup (one-time):**
1. Create a Google Cloud project → enable Gmail API → create OAuth2 credentials (Desktop app type)
2. Run a local helper script to complete the OAuth consent flow and save `token.json`
3. Paste the contents of `token.json` as the `GMAIL_CREDENTIALS` env var in `.env` and Vercel dashboard

---

## core/email_parser.py

Responsibilities:
- One parsing function for the bank's fixed email format
- Uses regex/string extraction (no AI — the format is fixed and structured)
- Returns `{ merchant: str, amount: float, date: str }`
- Raises a descriptive error if the expected fields cannot be found (so the email is not silently dropped)

The exact regex patterns are determined during implementation by inspecting a sample bank email.

---

## New Environment Variables

| Variable | Description |
|----------|-------------|
| `SHORTCUT_API_KEY` | Static secret shared between iOS Shortcut and Vercel |
| `CRON_SECRET` | Secret Vercel sends on cron requests; set in Vercel dashboard |
| `GMAIL_CREDENTIALS` | OAuth2 token JSON for Gmail API (from one-time local setup) |
| `GMAIL_QUERY` | Gmail search query to filter bank notification emails |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Wrong API key / cron secret | `401 Unauthorized` |
| Categorization fails | Save with category `"Uncategorized"`, do not drop |
| Email body doesn't match parser | Log error, skip that email, continue processing others |
| Gmail API unavailable | Return `503`, cron retries on next 10-min tick |
| Supabase insert fails | Return `500`, email stays unread and will be retried next poll |

---

## Out of Scope

- Deduplication between Apple Pay and email paths (not needed — mutually exclusive sources)
- Support for multiple bank email formats (single bank for now; add more parsers later if needed)
- Real-time email delivery (10-minute polling is sufficient for expense tracking)
