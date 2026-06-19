from typing import Optional
from fastapi import APIRouter, HTTPException
from core.db import supabase
from core.models import TransactionCreate, TransactionUpdate

router = APIRouter()


@router.get("")
def list_transactions(month: Optional[str] = None):
    query = supabase.table("transactions").select("*").order("date", desc=True)
    if month:
        start = f"{month}-01"
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        next_mon = 1 if mon == 12 else mon + 1
        next_year = year + 1 if mon == 12 else year
        end = f"{next_year}-{next_mon:02d}-01"
        query = query.gte("date", start).lt("date", end)
    result = query.execute()
    return result.data


@router.post("", status_code=201)
def create_transaction(tx: TransactionCreate):
    payload = tx.model_dump()
    payload["date"] = payload["date"].isoformat()
    result = supabase.table("transactions").insert(payload).execute()
    return result.data[0]


@router.put("/{tx_id}")
def update_transaction(tx_id: str, tx: TransactionUpdate):
    payload = {k: v for k, v in tx.model_dump().items() if v is not None}
    if "date" in payload:
        payload["date"] = payload["date"].isoformat()
    result = supabase.table("transactions").update(payload).eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result.data[0]


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: str):
    result = supabase.table("transactions").delete().eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
