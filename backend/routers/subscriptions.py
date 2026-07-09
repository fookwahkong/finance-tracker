from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import SubscriptionCreate

router = APIRouter()


@router.get("")
def list_subscriptions(db: Client = Depends(get_db)):
    return db.table("subscriptions").select("*").order("day_of_month").execute().data


@router.post("")
def create_subscription(sub: SubscriptionCreate, db: Client = Depends(get_db)):
    result = db.table("subscriptions").insert(sub.model_dump()).execute()
    return result.data[0]


@router.put("/{sub_id}")
def update_subscription(sub_id: str, sub: SubscriptionCreate, db: Client = Depends(get_db)):
    result = db.table("subscriptions").update(sub.model_dump()).eq("id", sub_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return result.data[0]


@router.delete("/{sub_id}", status_code=204)
def delete_subscription(sub_id: str, db: Client = Depends(get_db)):
    result = db.table("subscriptions").delete().eq("id", sub_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
