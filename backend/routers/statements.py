from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from supabase import Client

from backend.deps import enforce_ai_limit, get_db
from core.models import ImportRequest
from core.statement import categorize_rows, extract_rows
from core.validation import ValidationError, validate_transaction

router = APIRouter()


def _known_categories(db: Client) -> list[str]:
    return [c["name"] for c in db.table("categories").select("name").execute().data]


@router.post("/parse")
async def parse_statement(
    file: UploadFile = File(...),
    _: None = Depends(enforce_ai_limit),
    db: Client = Depends(get_db),
):
    data = await file.read()
    try:
        rows = extract_rows(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not rows:
        raise HTTPException(
            status_code=422,
            detail="Couldn't find a transaction table in this statement.",
        )

    categories = _known_categories(db)
    cats = categorize_rows([r["item"] for r in rows], categories)

    out = []
    for row, cat in zip(rows, cats):
        magnitude = abs(row["amount"])
        amount = magnitude if row["direction"] == "in" else -magnitude
        if row["source"] == "paylah":
            suggested_category, is_new = "Food & Drink", False
        else:
            suggested_category, is_new = cat["category"], cat["is_new"]
        out.append(
            {
                "date": row["date"],
                "item": row["item"],
                "amount": amount,
                "source": row["source"],
                "suggested_category": suggested_category,
                "is_new": is_new,
            }
        )
    return {"rows": out}


@router.post("/import")
def import_statement(req: ImportRequest, db: Client = Depends(get_db)):
    known = _known_categories(db)
    inserted = 0
    for row in req.rows:
        if row.category and row.category not in known:
            db.table("categories").insert({"name": row.category}).execute()
            known.append(row.category)
        try:
            validated = validate_transaction(row.model_dump(), known)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        payload = validated.model_dump()
        payload["date"] = payload["date"].isoformat()
        db.table("transactions").insert(payload).execute()
        inserted += 1
    return {"inserted": inserted}
