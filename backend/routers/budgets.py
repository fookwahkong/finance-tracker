from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import BudgetUpsert

router = APIRouter()


@router.get("")
def list_budgets(db: Client = Depends(get_db)):
    return db.table("budgets").select("*").order("category").execute().data


@router.put("")
def upsert_budget(budget: BudgetUpsert, db: Client = Depends(get_db)):
    payload = {"category": budget.category, "amount": budget.amount}
    result = db.table("budgets").upsert(payload, on_conflict="user_id,category").execute()
    return result.data[0]


@router.delete("/{category}", status_code=204)
def delete_budget(category: str, db: Client = Depends(get_db)):
    result = db.table("budgets").delete().eq("category", category).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget not found")
