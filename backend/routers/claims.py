from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from supabase import Client

import core.claims as claim_math
from backend.deps import get_db
from core.models import ClaimCreate, ClaimCreditCreate
from core.validation import ValidationError

router = APIRouter()


def _one(db: Client, table: str, row_id: str):
    # read one row of data
    rows = db.table(table).select("*").eq("id", row_id).execute().data
    return rows[0] if rows else None


def _links_for_claim(db: Client, claim_id: str) -> list[dict]:
    return db.table("claim_credits").select("*").eq("claim_id", claim_id).execute().data or []


def _enrich_claim(db: Client, claim: dict) -> dict:
    links = _links_for_claim(db, claim["id"])
    received = claim_math.received_total(links)
    enriched = dict(claim)
    enriched["links"] = links
    enriched["received"] = received
    enriched["remaining"] = claim_math.remaining(claim["expected"], links)
    return enriched


@router.post("", status_code=201)
def create_claim(claim: ClaimCreate, db: Client = Depends(get_db)):
    debit = _one(db, "transactions", claim.debit_tx_id)
    if not debit:
        raise ValidationError("Debit transaction not found.")

    # only support the scenario where you paid on behalf of others
    # does not support the scenario where people gave you extra for you to pay others
    if debit["amount"] >= 0:
        raise ValidationError("Claims can only be created from debit transactions.")

    total = abs(debit["amount"])
    if claim.my_share < 0 or claim.my_share >= total:
        raise ValidationError("My share must be at least 0 and less than the debit total.")

    existing = (
        db.table("claims").select("*").eq("debit_tx_id", claim.debit_tx_id).execute().data
    )
    if existing:
        raise ValidationError("A claim already exists for this debit.")

    payload = {
        "debit_tx_id": claim.debit_tx_id,
        "total": total,
        "my_share": claim.my_share,
        "expected": claim_math.expected_amount(total, claim.my_share),
        "category": debit.get("category"),
        "counterparty": claim.counterparty,
        "status": "open",
    }
    result = db.table("claims").insert(payload).execute()
    return result.data[0]


@router.get("")
def list_claims(status: Optional[str] = None, db: Client = Depends(get_db)):
    query = db.table("claims").select("*")
    if status:
        rows = query.eq("status", status).execute().data
    else:
        rows = query.execute().data
    return [_enrich_claim(db, row) for row in (rows or [])]


@router.post("/{claim_id}/credits", status_code=201)
def link_credit(claim_id: str, credit: ClaimCreditCreate, db: Client = Depends(get_db)):
    if credit.allocated_amount <= 0:
        raise ValidationError("Allocated amount must be positive.")

    tx = _one(db, "transactions", credit.credit_tx_id)
    if not tx:
        raise ValidationError("Credit transaction not found.")
    if tx["amount"] <= 0:
        raise ValidationError("Only credit transactions can be linked to claims.")

    existing = (
        db.table("claim_credits")
        .select("*")
        .eq("credit_tx_id", credit.credit_tx_id)
        .execute()
        .data
        or []
    )
    already_allocated = claim_math.received_total(existing)
    if already_allocated + credit.allocated_amount > tx["amount"]:
        raise ValidationError("Allocated amount exceeds the credit transaction amount.")

    payload = {
        "claim_id": claim_id,
        "credit_tx_id": credit.credit_tx_id,
        "allocated_amount": credit.allocated_amount,
    }
    result = db.table("claim_credits").insert(payload).execute()
    return result.data[0]


@router.delete("/{claim_id}/credits/{link_id}", status_code=204)
def unlink_credit(claim_id: str, link_id: str, db: Client = Depends(get_db)):
    db.table("claim_credits").delete().eq("claim_id", claim_id).eq("id", link_id).execute()


@router.post("/{claim_id}/settle")
def settle_claim(claim_id: str, db: Client = Depends(get_db)):
    payload = {"status": "settled", "settled_at": datetime.now(timezone.utc).isoformat()}
    result = db.table("claims").update(payload).eq("id", claim_id).execute()
    return result.data[0]


@router.post("/{claim_id}/reopen")
def reopen_claim(claim_id: str, db: Client = Depends(get_db)):
    payload = {"status": "open", "settled_at": None}
    result = db.table("claims").update(payload).eq("id", claim_id).execute()
    return result.data[0]


@router.delete("/{claim_id}", status_code=204)
def delete_claim(claim_id: str, db: Client = Depends(get_db)):
    db.table("claims").delete().eq("id", claim_id).execute()
