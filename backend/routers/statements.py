from fastapi import APIRouter, File, HTTPException, UploadFile

from core.db import supabase
from core.models import ImportRequest
from core.statement import categorize_rows, extract_rows
from core.validation import ValidationError, validate_transaction

router = APIRouter()


def _known_categories() -> list[str]:
    return [c["name"] for c in supabase.table("categories").select("name").execute().data]


@router.post("/parse")
async def parse_statement(file: UploadFile = File(...)):
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

    categories = _known_categories()
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
def import_statement(req: ImportRequest):
    known = _known_categories()
    inserted = 0
    for row in req.rows:
        if row.category and row.category not in known:
            supabase.table("categories").insert({"name": row.category}).execute()
            known.append(row.category)
        try:
            validated = validate_transaction(row.model_dump(), known)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        payload = validated.model_dump()
        payload["date"] = payload["date"].isoformat()
        supabase.table("transactions").insert(payload).execute()
        inserted += 1
    return {"inserted": inserted}
