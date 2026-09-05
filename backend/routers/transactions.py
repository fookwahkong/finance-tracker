from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import TransactionCreate, TransactionUpdate
from core.validation import validate_transaction

router = APIRouter()


def _known_categories(db: Client) -> list[str]:
    return [c["name"] for c in db.table("categories").select("name").execute().data]


@router.get("")
def list_transactions(month: Optional[str] = None, db: Client = Depends(get_db)):
    query = db.table("transactions").select("*").order("date", desc=True)
    if month:
        start = f"{month}-01"
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        next_mon = 1 if mon == 12 else mon + 1
        next_year = year + 1 if mon == 12 else year
        end = f"{next_year}-{next_mon:02d}-01"
        query = query.gte("date", start).lt("date", end)
    result = query.execute()
    return result.data


_CURRENCY_FIELDS = {"amount", "foreign_amount", "currency"}


def _fx_unavailable(currency: str, exc: Exception) -> HTTPException:
    """Validation only raises RuntimeError from the FX lookup a non-SGD amount
    needs, so it means the rate provider is down — an upstream failure, not a
    bad request. Say which half broke; a bare 502 is indistinguishable from a
    database problem to whoever is looking at the app."""
    return HTTPException(
        status_code=502,
        detail=(
            f"Could not convert {currency} to SGD: the exchange-rate provider is "
            f"unavailable. Try again shortly, or enter the amount in SGD. ({exc})"
        ),
    )


@router.post("", status_code=201)
def create_transaction(tx: TransactionCreate, db: Client = Depends(get_db)):
    try:
        validated = validate_transaction(tx.model_dump(), _known_categories(db))
    except RuntimeError as exc:
        raise _fx_unavailable(tx.currency, exc) from exc
    payload = validated.model_dump()
    payload["date"] = payload["date"].isoformat()
    result = db.table("transactions").insert(payload).execute()
    return result.data[0]


@router.put("/{tx_id}")
def update_transaction(tx_id: str, tx: TransactionUpdate, db: Client = Depends(get_db)):
    existing = db.table("transactions").select("*").eq("id", tx_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    provided = {k: v for k, v in tx.model_dump().items() if v is not None}
    merged = {**existing[0], **provided}
    try:
        validated = validate_transaction(merged, _known_categories(db))
    except RuntimeError as exc:
        raise _fx_unavailable(merged.get("currency") or "SGD", exc) from exc
    payload_keys = set(provided)
    # amount is derived from foreign_amount + currency, so changing any one of
    # the three must write back all three or the recomputed amount is lost.
    if payload_keys & _CURRENCY_FIELDS:
        payload_keys |= _CURRENCY_FIELDS
    payload = {k: getattr(validated, k) for k in payload_keys}
    if "date" in payload:
        payload["date"] = payload["date"].isoformat()
    result = db.table("transactions").update(payload).eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result.data[0]


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: str, db: Client = Depends(get_db)):
    result = db.table("transactions").delete().eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
