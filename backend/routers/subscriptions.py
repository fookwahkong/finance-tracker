from fastapi import APIRouter, HTTPException

from core.db import supabase
from core.models import SubscriptionCreate

router = APIRouter()


@router.get("")
def list_subscriptions():
    return supabase.table("subscriptions").select("*").order("day_of_month").execute().data


@router.post("")
def create_subscription(sub: SubscriptionCreate):
    result = supabase.table("subscriptions").insert(sub.model_dump()).execute()
    return result.data[0]


@router.put("/{sub_id}")
def update_subscription(sub_id: str, sub: SubscriptionCreate):
    result = supabase.table("subscriptions").update(sub.model_dump()).eq("id", sub_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return result.data[0]


@router.delete("/{sub_id}", status_code=204)
def delete_subscription(sub_id: str):
    result = supabase.table("subscriptions").delete().eq("id", sub_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
