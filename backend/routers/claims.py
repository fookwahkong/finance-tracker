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


def _group_by_claim(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["claim_id"], []).append(row)
    return grouped


def _links_by_claim(db: Client, claim_ids: list[str]) -> dict[str, list[dict]]:
    if not claim_ids:
        return {}
    rows = db.table("claim_credits").select("*").in_("claim_id", claim_ids).execute().data or []
    return _group_by_claim(rows)


def _participants_by_claim(db: Client, claim_ids: list[str]) -> dict[str, list[dict]]:
    if not claim_ids:
        return {}
    rows = (
        db.table("claim_participants").select("*").in_("claim_id", claim_ids).execute().data or []
    )
    return _group_by_claim(rows)


def _enrich_claim(claim: dict, links: list[dict], participants: list[dict]) -> dict:
    enriched = dict(claim)
    if not participants:
        received = claim_math.received_total(links)
        enriched["links"] = links
        enriched["received"] = received
        enriched["remaining"] = claim_math.remaining(claim["expected"], links)
        return enriched

    total_expected = 0.0
    total_received = 0.0
    enriched_participants = []
    for participant in participants:
        participant_links = [
            link for link in links if link.get("participant_id") == participant["id"]
        ]
        received = claim_math.received_total(participant_links)
        owed = float(participant["share_amount"])
        remaining = owed - received
        enriched_participant = {
            **participant,
            "links": participant_links,
            "received": received,
            "remaining": remaining,
            "overpaid": max(0, -remaining),
        }
        enriched_participants.append(enriched_participant)
        if not participant["is_owner"]:
            total_expected += owed
            total_received += received

    owner = next((participant for participant in participants if participant["is_owner"]), None)
    enriched["participants"] = enriched_participants
    enriched["links"] = links
    enriched["my_share"] = float(owner["share_amount"]) if owner else 0
    enriched["expected"] = total_expected
    enriched["received"] = total_received
    enriched["remaining"] = total_expected - total_received
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

    existing = db.table("claims").select("*").eq("debit_tx_id", claim.debit_tx_id).execute().data
    if existing:
        raise ValidationError("A claim already exists for this debit.")

    if claim.participant_names:
        try:
            participants = claim_math.participant_split(
                total,
                claim.participant_names,
                claim.split_mode,
                claim.my_share_percent,
            )
        except ValueError as error:
            raise ValidationError(str(error)) from error
        owner_share = participants[0]["share_amount"]
        expected = sum(participant["share_amount"] for participant in participants[1:])
        counterparty = ", ".join(participant["name"] for participant in participants[1:])
    else:
        if claim.my_share is None or claim.my_share < 0 or claim.my_share >= total:
            raise ValidationError("My share must be at least 0 and less than the debit total.")
        owner_share = claim.my_share
        expected = claim_math.expected_amount(total, owner_share)
        counterparty = claim.counterparty
        participants = []

    payload = {
        "debit_tx_id": claim.debit_tx_id,
        "total": total,
        "my_share": owner_share,
        "expected": expected,
        "category": debit.get("category"),
        "counterparty": counterparty,
        "status": "open",
    }
    result = db.table("claims").insert(payload).execute()
    if participants:
        participant_rows = [
            {"claim_id": result.data[0]["id"], **participant} for participant in participants
        ]
        db.table("claim_participants").insert(participant_rows).execute()
    return result.data[0]


@router.get("")
def list_claims(status: Optional[str] = None, db: Client = Depends(get_db)):
    query = db.table("claims").select("*")
    if status:
        rows = query.eq("status", status).execute().data
    else:
        rows = query.execute().data
    rows = rows or []

    claim_ids = [row["id"] for row in rows]
    links_by_claim = _links_by_claim(db, claim_ids)
    participants_by_claim = _participants_by_claim(db, claim_ids)

    return [
        _enrich_claim(
            row, links_by_claim.get(row["id"], []), participants_by_claim.get(row["id"], [])
        )
        for row in rows
    ]


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
        db.table("claim_credits").select("*").eq("credit_tx_id", credit.credit_tx_id).execute().data
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


@router.post("/{claim_id}/participants/{participant_id}/credits", status_code=201)
def link_participant_credit(
    claim_id: str,
    participant_id: str,
    credit: ClaimCreditCreate,
    db: Client = Depends(get_db),
):
    if credit.allocated_amount <= 0:
        raise ValidationError("Allocated amount must be positive.")
    if not _one(db, "claims", claim_id):
        raise ValidationError("Claim not found.")

    participant = _one(db, "claim_participants", participant_id)
    if not participant or participant.get("claim_id") != claim_id:
        raise ValidationError("Participant does not belong to this claim.")
    if participant.get("is_owner"):
        raise ValidationError("Repayments cannot be assigned to the owner.")

    tx = _one(db, "transactions", credit.credit_tx_id)
    if not tx:
        raise ValidationError("Credit transaction not found.")
    if tx["amount"] <= 0:
        raise ValidationError("Only credit transactions can be linked to claims.")

    existing = (
        db.table("claim_credits").select("*").eq("credit_tx_id", credit.credit_tx_id).execute().data
        or []
    )
    if claim_math.received_total(existing) + credit.allocated_amount > tx["amount"]:
        raise ValidationError("Allocated amount exceeds the credit transaction amount.")

    payload = {
        "claim_id": claim_id,
        "participant_id": participant_id,
        "credit_tx_id": credit.credit_tx_id,
        "allocated_amount": credit.allocated_amount,
    }
    return db.table("claim_credits").insert(payload).execute().data[0]


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
