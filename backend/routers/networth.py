from fastapi import APIRouter
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
