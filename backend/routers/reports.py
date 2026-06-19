from fastapi import APIRouter, Query
from core.db import supabase
from core.calc import month_range, monthly_summary

router = APIRouter()


@router.get("/monthly")
def monthly_report(month: str = Query(..., description="YYYY-MM")):
    start, end = month_range(month)
    rows = (
        supabase.table("transactions")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .execute()
        .data
    )
    return {"month": month, **monthly_summary(rows)}
