from fastapi import APIRouter, Depends, Query
from supabase import Client

from backend.deps import get_db
from core.calc import month_range, monthly_summary

router = APIRouter()


@router.get("/monthly")
def monthly_report(month: str = Query(..., description="YYYY-MM"), db: Client = Depends(get_db)):
    start, end = month_range(month)
    rows = db.table("transactions").select("*").gte("date", start).lt("date", end).execute().data
    return {"month": month, **monthly_summary(rows)}
