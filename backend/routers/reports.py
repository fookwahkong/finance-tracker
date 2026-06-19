from datetime import date
from fastapi import APIRouter, Query
from core.db import supabase

router = APIRouter()


@router.get("/monthly")
def monthly_report(month: str = Query(..., description="YYYY-MM")):
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    next_mon = 1 if mon == 12 else mon + 1
    next_year = year + 1 if mon == 12 else year
    start = f"{month}-01"
    end = f"{next_year}-{next_mon:02d}-01"

    result = (
        supabase.table("transactions")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .execute()
    )
    transactions = result.data

    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    total_expenses = sum(t["amount"] for t in transactions if t["amount"] < 0)
    net = total_income + total_expenses

    breakdown: dict[str, float] = {}
    for t in transactions:
        cat = t.get("category") or "Uncategorized"
        breakdown[cat] = breakdown.get(cat, 0) + t["amount"]

    return {
        "month": month,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": net,
        "breakdown": breakdown,
    }
