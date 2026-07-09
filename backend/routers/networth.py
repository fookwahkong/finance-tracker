from fastapi import APIRouter, HTTPException

from core.db import supabase
from core.models import NetWorthUpsert

router = APIRouter()


@router.get("")
def list_net_worth():
    return supabase.table("net_worth").select("*").order("month").execute().data


@router.put("")
def upsert_net_worth(entry: NetWorthUpsert):
    payload = {"month": entry.month, "cash": entry.cash}
    result = supabase.table("net_worth").upsert(payload, on_conflict="month").execute()
    return result.data[0]


@router.delete("/{month}", status_code=204)
def delete_net_worth(month: str):
    result = supabase.table("net_worth").delete().eq("month", month).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Anchor not found")
