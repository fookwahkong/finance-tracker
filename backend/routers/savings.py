from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.savings import due_automatic_months

router = APIRouter()


@router.get("")
def list_savings(db: Client = Depends(get_db)):
    profile_rows = db.table("saving_profiles").select("*").limit(1).execute().data
    goals = db.table("saving_goals").select("*").order("created_at").execute().data
    contributions = (
        db.table("saving_contributions").select("*").order("created_at").execute().data
    )
    return {
        "profile": profile_rows[0] if profile_rows else None,
        "goals": goals,
        "contributions": contributions,
    }

def _validated_profile(payload):
    salary = float(payload.get("salary", -1))
    payday = int(payload.get("payday", 0))
    if salary < 0 or payday not in range(1, 32):
        raise HTTPException(status_code=422, detail="Salary must be non-negative and payday must be 1?31.")
    return {"salary": salary, "payday": payday}


def _validated_goal(payload):
    name = str(payload.get("name", "")).strip()
    target_amount = float(payload.get("target_amount", 0))
    allocation_percentage = float(payload.get("allocation_percentage", -1))
    if not name or target_amount <= 0 or not 0 <= allocation_percentage <= 100:
        raise HTTPException(status_code=422, detail="Enter a name, positive target, and 0?100% allocation.")
    return {
        "name": name,
        "target_amount": target_amount,
        "allocation_percentage": allocation_percentage,
    }


def _assert_allocation_limit(db, percentage, goal_id=None):
    goals = db.table("saving_goals").select("id, allocation_percentage").execute().data
    total = sum(float(goal["allocation_percentage"]) for goal in goals if goal["id"] != goal_id)
    if total + percentage > 100:
        raise HTTPException(status_code=422, detail="Savings goal allocations cannot exceed 100%.")


@router.put("/profile")
def upsert_profile(payload: dict, db: Client = Depends(get_db)):
    profile = _validated_profile(payload)
    result = db.table("saving_profiles").upsert(profile, on_conflict="user_id").execute()
    return result.data[0]


@router.post("/goals", status_code=201)
def create_goal(payload: dict, db: Client = Depends(get_db)):
    goal = _validated_goal(payload)
    _assert_allocation_limit(db, goal["allocation_percentage"])
    result = db.table("saving_goals").insert(goal).execute()
    return result.data[0]


@router.put("/goals/{goal_id}")
def update_goal(goal_id: str, payload: dict, db: Client = Depends(get_db)):
    goal = _validated_goal(payload)
    _assert_allocation_limit(db, goal["allocation_percentage"], goal_id)
    result = db.table("saving_goals").update(goal).eq("id", goal_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return result.data[0]


@router.delete("/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: str, db: Client = Depends(get_db)):
    result = db.table("saving_goals").delete().eq("id", goal_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Savings goal not found")


@router.post("/goals/{goal_id}/contributions", status_code=201)
def add_manual_contribution(goal_id: str, payload: dict, db: Client = Depends(get_db)):
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Extra cash must be greater than zero.")
    result = db.table("saving_contributions").insert({
        "goal_id": goal_id,
        "amount": amount,
        "kind": "manual",
        "contribution_month": date.today().strftime("%Y-%m"),
    }).execute()
    return result.data[0]


@router.post("/sync")
def sync_automatic_contributions(db: Client = Depends(get_db)):
    profile_rows = db.table("saving_profiles").select("*").limit(1).execute().data
    if not profile_rows or float(profile_rows[0]["salary"]) == 0:
        return {"created": 0}

    profile = profile_rows[0]
    goals = db.table("saving_goals").select("*").execute().data
    contributions = db.table("saving_contributions").select("goal_id, contribution_month, kind").execute().data
    existing = {(row["goal_id"], row["contribution_month"]) for row in contributions if row["kind"] == "automatic"}
    created = 0
    for goal in goals:
        created_at = date.fromisoformat(goal["created_at"][:10])
        for month in due_automatic_months(created_at, date.today(), int(profile["payday"])):
            key = (goal["id"], month)
            if key in existing:
                continue
            db.table("saving_contributions").insert({
                "goal_id": goal["id"],
                "amount": round(float(profile["salary"]) * float(goal["allocation_percentage"]) / 100, 2),
                "kind": "automatic",
                "contribution_month": month,
            }).execute()
            existing.add(key)
            created += 1
    return {"created": created}
