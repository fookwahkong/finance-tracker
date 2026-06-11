import json
import os
from datetime import date
from typing import Optional

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()

supabase: Client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ───────────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    date: str
    item: str
    category: Optional[str] = None
    amount: float
    source: Optional[str] = None
    remarks: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    item: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None
    remarks: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str


# ── LLM parser ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a personal finance transaction parser.
Given a natural-language description of a transaction, extract the details and return ONLY a valid JSON object with these fields:
- date (string, YYYY-MM-DD — use today's date if not mentioned)
- item (string, short description of what was bought/received)
- category (string, pick the best match from the provided list, or null if none fit)
- amount (number, negative for expenses, positive for income)
- source (string, payment method if mentioned, otherwise null)
- remarks (string, any extra notes, otherwise null)

Return ONLY the raw JSON object. No markdown, no explanation."""


def parse_transaction(raw_text: str, categories: list[str]) -> dict:
    today = date.today().isoformat()
    user_message = (
        f"Today's date: {today}\n"
        f"Available categories: {', '.join(categories)}\n\n"
        f"Transaction: {raw_text}"
    )
    message = _anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return json.loads(message.content[0].text.strip())


def _month_range(month: str) -> tuple[str, str]:
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    next_mon = 1 if mon == 12 else mon + 1
    next_year = year + 1 if mon == 12 else year
    return f"{month}-01", f"{next_year}-{next_mon:02d}-01"


# ── Transactions ─────────────────────────────────────────────────────────────

@app.get("/api/transactions")
def list_transactions(month: Optional[str] = Query(None)):
    try:
        q = supabase.table("transactions").select("*").order("date", desc=True)
        if month:
            start, end = _month_range(month)
            q = q.gte("date", start).lt("date", end)
        return q.execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transactions", status_code=201)
def create_transaction(tx: TransactionCreate):
    try:
        result = supabase.table("transactions").insert(tx.model_dump()).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/transactions/{tx_id}")
def update_transaction(tx_id: str, tx: TransactionUpdate):
    try:
        payload = {k: v for k, v in tx.model_dump().items() if v is not None}
        result = supabase.table("transactions").update(payload).eq("id", tx_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: str):
    try:
        supabase.table("transactions").delete().eq("id", tx_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Categories ───────────────────────────────────────────────────────────────

@app.get("/api/categories")
def list_categories():
    try:
        return supabase.table("categories").select("*").order("name").execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/categories", status_code=201)
def create_category(cat: CategoryCreate):
    try:
        result = supabase.table("categories").insert({"name": cat.name}).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/categories/{cat_id}", status_code=204)
def delete_category(cat_id: str):
    try:
        supabase.table("categories").delete().eq("id", cat_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Reports ──────────────────────────────────────────────────────────────────

@app.get("/api/reports/monthly")
def monthly_report(month: str = Query(...)):
    try:
        start, end = _month_range(month)
        rows = (
            supabase.table("transactions")
            .select("*")
            .gte("date", start)
            .lt("date", end)
            .execute()
            .data
        )
        total_income = sum(r["amount"] for r in rows if r["amount"] > 0)
        total_expenses = sum(r["amount"] for r in rows if r["amount"] < 0)
        breakdown: dict[str, float] = {}
        for r in rows:
            cat = r.get("category") or "Uncategorized"
            breakdown[cat] = breakdown.get(cat, 0) + r["amount"]
        return {
            "month": month,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net": total_income + total_expenses,
            "breakdown": breakdown,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Telegram webhook ─────────────────────────────────────────────────────────

@app.post("/api/webhook")
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
    text = message.get("text", "").strip()

    if not text or not chat_id:
        return {"ok": True}

    try:
        cats = [c["name"] for c in supabase.table("categories").select("name").execute().data]
        parsed = parse_transaction(text, cats)
        tx = supabase.table("transactions").insert(parsed).execute().data[0]
        sign = "+" if tx["amount"] > 0 else ""
        reply = (
            f"Recorded: {tx['item']}\n"
            f"Amount: {sign}{tx['amount']}\n"
            f"Category: {tx.get('category') or 'Uncategorized'}\n"
            f"Date: {tx['date']}"
        )
    except json.JSONDecodeError:
        reply = "Could not parse that. Try: 'Coffee 4.50 Food' or 'Salary 3000 Income'"
    except Exception as e:
        reply = f"Error: {str(e)}"

    with httpx.Client() as client:
        client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": reply},
        )
    return {"ok": True}


# Vercel calls this as the serverless entry point
handler = Mangum(app, lifespan="off")
