"""Travel groups: CRUD over a named date range, plus membership overrides.

Deliberately thin. Because the SPA already loads the full transaction list and
aggregates client-side, there is no trip-aggregation endpoint here — a trip is
a different filter over data the browser already holds. The server's job is to
own the group rows and the one rule the client cannot enforce: no two trips of
the same user may overlap.
"""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import TravelGroupCreate, TravelGroupUpdate, TravelOverrideUpsert
from core.travel import TravelError, find_overlap, validate_group

router = APIRouter()


def _groups(db: Client) -> list[dict]:
    return db.table("travel_groups").select("*").order("start_date", desc=True).execute().data or []


def _group_or_404(db: Client, group_id: str) -> dict:
    rows = db.table("travel_groups").select("*").eq("id", group_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Trip not found")
    return rows[0]


def _assert_no_overlap(db: Client, group: dict, ignore_id: str | None = None) -> None:
    clash = find_overlap(group, _groups(db), ignore_id=ignore_id)
    if clash is None:
        return
    raise HTTPException(
        status_code=422,
        detail=(
            f"These dates overlap your '{clash['name']}' trip "
            f"({clash['start_date']} to {clash['end_date']}). "
            "A day can only belong to one trip."
        ),
    )


@router.get("/groups")
def list_groups(db: Client = Depends(get_db)):
    """Groups newest-first, each with its override rows attached.

    Overrides ship with the group because the client needs them to derive
    membership, and a trip has a handful at most — a second round trip would
    buy nothing.
    """
    groups = _groups(db)
    if not groups:
        return []
    overrides = (
        db.table("travel_group_transactions")
        .select("*")
        .in_("group_id", [g["id"] for g in groups])
        .execute()
        .data
        or []
    )
    by_group: dict[str, list[dict]] = {}
    for row in overrides:
        by_group.setdefault(row["group_id"], []).append(row)
    return [{**group, "overrides": by_group.get(group["id"], [])} for group in groups]


@router.post("/groups", status_code=201)
def create_group(payload: TravelGroupCreate, db: Client = Depends(get_db)):
    try:
        group = validate_group(payload.model_dump())
    except TravelError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    _assert_no_overlap(db, group)
    result = db.table("travel_groups").insert(group).execute()
    return {**result.data[0], "overrides": []}


@router.put("/groups/{group_id}")
def update_group(group_id: str, payload: TravelGroupUpdate, db: Client = Depends(get_db)):
    existing = _group_or_404(db, group_id)
    provided = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        group = validate_group({**existing, **provided})
    except TravelError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    _assert_no_overlap(db, group, ignore_id=group_id)
    result = db.table("travel_groups").update(group).eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Trip not found")
    return result.data[0]


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: str, db: Client = Depends(get_db)):
    """Deletes the grouping only. Transactions are never touched — the group
    never owned them, it only described a date range."""
    result = db.table("travel_groups").delete().eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Trip not found")


@router.post("/groups/{group_id}/transactions", status_code=201)
def upsert_override(
    group_id: str, payload: TravelOverrideUpsert, db: Client = Depends(get_db)
):
    """Force a transaction into ('include') or out of ('exclude') a trip.

    'include' is how a flight booked six weeks early joins the trip it paid
    for; 'exclude' is how mid-trip rent stays out of it.
    """
    _group_or_404(db, group_id)
    row = {
        "group_id": group_id,
        "transaction_id": payload.transaction_id,
        "mode": payload.mode,
    }
    result = (
        db.table("travel_group_transactions")
        .upsert(row, on_conflict="group_id,transaction_id")
        .execute()
    )
    return result.data[0]


@router.delete("/groups/{group_id}/transactions/{tx_id}", status_code=204)
def clear_override(group_id: str, tx_id: str, db: Client = Depends(get_db)):
    """Drop an override, returning the transaction to plain date derivation."""
    result = (
        db.table("travel_group_transactions")
        .delete()
        .eq("group_id", group_id)
        .eq("transaction_id", tx_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Override not found")
