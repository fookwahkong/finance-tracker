import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from backend.demo_seed import build_claims, seed_rows
from core.db import supabase

router = APIRouter()

# Delete children before parents to respect FK constraints.
_WIPE_ORDER = [
    "claim_credits",
    "claims",
    "transactions",
    "budgets",
    "subscriptions",
    "net_worth",
    "invest_transactions",
    "watchlist",
    "categories",
    "ai_usage",
]


def _verify_cron_secret(authorization: str = Header(...)):
    if authorization != f"Bearer {os.environ.get('CRON_SECRET', '')}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/reset")
def reset_demo(_=Depends(_verify_cron_secret)):
    demo_id = os.environ["DEMO_USER_ID"]

    for table in _WIPE_ORDER:
        supabase.table(table).delete().eq("user_id", demo_id).execute()

    today = datetime.now(timezone.utc).date()
    rows = seed_rows(demo_id, today)
    counts = {}
    inserted_transactions = []
    for table, items in rows.items():
        if items:
            result = supabase.table(table).insert(items).execute()
            if table == "transactions":
                inserted_transactions = result.data
        counts[table] = len(items)

    claims = build_claims(inserted_transactions)
    if claims:
        supabase.table("claims").insert(claims).execute()
    counts["claims"] = len(claims)

    return {"reset": True, "counts": counts}
