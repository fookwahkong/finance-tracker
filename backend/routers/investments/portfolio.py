from fastapi import APIRouter, HTTPException

from core.db import supabase
from core.models import InvestTransactionUpsert, WatchlistAdd

router = APIRouter()


def _payload(entry: InvestTransactionUpsert) -> dict:
    return {
        "ticker": entry.ticker.upper(),
        "type": entry.type,
        "quantity": entry.quantity,
        "price_per_share": entry.price_per_share,
        "purchase_date": entry.purchase_date,
    }


@router.get("/transactions")
def list_transactions():
    return (
        supabase.table("invest_transactions")
        .select("*")
        .order("purchase_date")
        .execute()
        .data
    )


@router.post("/transactions")
def create_transaction(entry: InvestTransactionUpsert):
    result = supabase.table("invest_transactions").insert(_payload(entry)).execute()
    return result.data[0]


@router.put("/transactions/{tx_id}")
def update_transaction(tx_id: str, entry: InvestTransactionUpsert):
    result = (
        supabase.table("invest_transactions")
        .update(_payload(entry))
        .eq("id", tx_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result.data[0]


@router.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: str):
    result = supabase.table("invest_transactions").delete().eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")


@router.get("/watchlist")
def list_watchlist():
    return (
        supabase.table("watchlist").select("*").order("added_at").execute().data
    )


@router.post("/watchlist")
def add_watchlist(entry: WatchlistAdd):
    result = (
        supabase.table("watchlist")
        .upsert({"ticker": entry.ticker.upper()}, on_conflict="ticker")
        .execute()
    )
    return result.data[0]


@router.delete("/watchlist/{ticker}", status_code=204)
def remove_watchlist(ticker: str):
    result = supabase.table("watchlist").delete().eq("ticker", ticker.upper()).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticker not on watchlist")
