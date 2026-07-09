from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import NetWorthUpsert

router = APIRouter()


@router.get("")
def list_net_worth(db: Client = Depends(get_db)):
    return db.table("net_worth").select("*").order("month").execute().data


@router.put("")
def upsert_net_worth(entry: NetWorthUpsert, db: Client = Depends(get_db)):
    payload = {"month": entry.month, "cash": entry.cash}
    result = db.table("net_worth").upsert(payload, on_conflict="user_id,month").execute()
    return result.data[0]


@router.delete("/{month}", status_code=204)
def delete_net_worth(month: str, db: Client = Depends(get_db)):
    result = db.table("net_worth").delete().eq("month", month).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Anchor not found")
