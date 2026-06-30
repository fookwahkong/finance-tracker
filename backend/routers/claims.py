from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter

import core.claims as claim_math
from core.db import supabase
from core.models import ClaimCreate, ClaimCreditCreate
from core.validation import ValidationError

router = APIRouter()


def _one(table: str, row_id: str):
    rows = supabase.table(table).select("*").eq("id", row_id).execute().data
    return rows[0] if rows else None


def _links_for_claim(claim_id: str) -> list[dict]:
    return supabase.table("claim_credits").select("*").eq("claim_id", claim_id).execute().data or []


def _enrich_claim(claim: dict) -> dict:
    links = _links_for_claim(claim["id"])
    received = claim_math.received_total(links)
    enriched = dict(claim)
    enriched["links"] = links
    enriched["received"] = received
    enriched["remaining"] = claim_math.remaining(claim["expected"], links)
    return enriched


@router.post("", status_code=201)
def create_claim(claim: ClaimCreate):
    debit = _one("transactions", claim.debit_tx_id)
    if not debit:
        raise ValidationError("Debit transaction not found.")
    if debit["amount"] >= 0:
        raise ValidationError("Claims can only be created from debit transactions.")

    total = abs(debit["amount"])
    if claim.my_share < 0 or claim.my_share >= total:
        raise ValidationError("My share must be at least 0 and less than the debit total.")

    existing = supabase.table("claims").select("*").eq("debit_tx_id", claim.debit_tx_id).execute().data
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
    result = supabase.table("claims").insert(payload).execute()
    return result.data[0]


@router.get("")
def list_claims(status: Optional[str] = None):
    query = supabase.table("claims").select("*")
    if status:
        rows = query.eq("status", status).execute().data
    else:
        rows = query.execute().data
    return [_enrich_claim(row) for row in (rows or [])]


@router.post("/{claim_id}/credits", status_code=201)
def link_credit(claim_id: str, credit: ClaimCreditCreate):
    if credit.allocated_amount <= 0:
        raise ValidationError("Allocated amount must be positive.")

    tx = _one("transactions", credit.credit_tx_id)
    if not tx:
        raise ValidationError("Credit transaction not found.")
    if tx["amount"] <= 0:
        raise ValidationError("Only credit transactions can be linked to claims.")

    existing = supabase.table("claim_credits").select("*").eq("credit_tx_id", credit.credit_tx_id).execute().data or []
    already_allocated = claim_math.received_total(existing)
    if already_allocated + credit.allocated_amount > tx["amount"]:
        raise ValidationError("Allocated amount exceeds the credit transaction amount.")

    payload = {
        "claim_id": claim_id,
        "credit_tx_id": credit.credit_tx_id,
        "allocated_amount": credit.allocated_amount,
    }
    result = supabase.table("claim_credits").insert(payload).execute()
    return result.data[0]


@router.delete("/{claim_id}/credits/{link_id}", status_code=204)
def unlink_credit(claim_id: str, link_id: str):
    supabase.table("claim_credits").delete().eq("claim_id", claim_id).eq("id", link_id).execute()


@router.post("/{claim_id}/settle")
def settle_claim(claim_id: str):
    payload = {"status": "settled", "settled_at": datetime.now(timezone.utc).isoformat()}
    result = supabase.table("claims").update(payload).eq("id", claim_id).execute()
    return result.data[0]


@router.post("/{claim_id}/reopen")
def reopen_claim(claim_id: str):
    payload = {"status": "open", "settled_at": None}
    result = supabase.table("claims").update(payload).eq("id", claim_id).execute()
    return result.data[0]


@router.delete("/{claim_id}", status_code=204)
def delete_claim(claim_id: str):
    supabase.table("claims").delete().eq("id", claim_id).execute()
