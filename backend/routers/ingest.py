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


def _insert(item: str, category: str, amount: float, tx_date: str, source: str, tx_time=None) -> dict:
    payload = {
        "date": tx_date,
        "time": tx_time,
        "item": item,
        "category": category,
        "amount": amount,
        "source": source,
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
        tx_time=parsed.get("time"),
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
            tx_time=parsed.get("time"),
        )
        gmail.mark_read(msg["id"])
        count += 1

    return {"processed": count}
