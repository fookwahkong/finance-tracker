from fastapi import APIRouter, Query

from core.calc import month_range, monthly_summary
from core.db import supabase

router = APIRouter()


@router.get("/monthly")
def monthly_report(month: str = Query(..., description="YYYY-MM")):
    start, end = month_range(month)
    rows = (
        supabase.table("transactions").select("*").gte("date", start).lt("date", end).execute().data
    )
    return {"month": month, **monthly_summary(rows)}
