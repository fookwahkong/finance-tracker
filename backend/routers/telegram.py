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
        payload["user_id"] = os.environ["PERSONAL_USER_ID"]
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
