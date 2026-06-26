from fastapi import APIRouter, HTTPException
from core.db import supabase
from core.models import BudgetUpsert

router = APIRouter()


@router.get("")
def list_budgets():
    return supabase.table("budgets").select("*").order("category").execute().data


@router.put("")
def upsert_budget(budget: BudgetUpsert):
    payload = {"category": budget.category, "amount": budget.amount}
    result = supabase.table("budgets").upsert(payload, on_conflict="category").execute()
    return result.data[0]


@router.delete("/{category}", status_code=204)
def delete_budget(category: str):
    result = supabase.table("budgets").delete().eq("category", category).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget not found")
