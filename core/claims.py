"""Pure, DB-free settlement math for shared-expense claims.

A claim's effect at settle reduces to subtracting `min(received, expected)`
from both the claim category's spending and from income, in the debit's month.
Gift income (variance > 0) and absorbed shortfall (variance < 0) emerge from
the residual real rows. See docs/superpowers/specs/2026-06-30-shared-expense-claims-design.md.
"""

from decimal import Decimal, ROUND_HALF_UP


def participant_split(
    total: float,
    participant_names: list[str],
    split_mode: str,
    owner_percent: float | None = None,
) -> list[dict]:
    """Return the exact, server-authoritative shares for a new claim."""
    clean_names = [str(name).strip() for name in participant_names]
    name_keys = [name.casefold() for name in clean_names]
    if not clean_names or any(not name for name in clean_names):
        raise ValueError("Add at least one participant name.")
    if "you" in name_keys or len(set(name_keys)) != len(name_keys):
        raise ValueError("Participant names must be unique and cannot be You.")
    if split_mode not in {"equal", "custom"}:
        raise ValueError("Split mode must be equal or custom.")

    total_cents = int((Decimal(str(total)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if total_cents <= 0:
        raise ValueError("Claim total must be positive.")

    participant_count = len(clean_names)
    if split_mode == "equal":
        named_cents = total_cents // (participant_count + 1)
        owner_share_percent = 100 / (participant_count + 1)
        named_share_percent = owner_share_percent
    else:
        if owner_percent is None:
            raise ValueError("A custom split requires your percentage.")
        owner_share_percent = float(owner_percent)
        if not 0 <= owner_share_percent < 100:
            raise ValueError("Your share must be at least 0% and less than 100%.")
        owner_cents = int(
            (Decimal(total_cents) * Decimal(str(owner_share_percent)) / 100)
            .quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        named_cents = (total_cents - owner_cents) // participant_count
        named_share_percent = (100 - owner_share_percent) / participant_count

    owner_cents = total_cents - (named_cents * participant_count)
    participants = [{
        "name": "You",
        "is_owner": True,
        "share_amount": owner_cents / 100,
        "share_percent": owner_share_percent,
    }]
    participants.extend({
        "name": name,
        "is_owner": False,
        "share_amount": named_cents / 100,
        "share_percent": named_share_percent,
    } for name in clean_names)
    return participants


def expected_amount(total: float, my_share: float) -> float:
    return total - my_share


def received_total(links: list[dict]) -> float:
    return sum(link["allocated_amount"] for link in links)


def remaining(expected: float, links: list[dict]) -> float:
    return expected - received_total(links)


def variance(received: float, expected: float) -> float:
    return received - expected


def settlement_amount(expected: float, received: float) -> float:
    return min(received, expected)


def settlement_effects(claim: dict, links: list[dict]) -> dict:
    expected = claim["expected"]
    received = received_total(links)
    var = variance(received, expected)
    return {
        "category": claim.get("category"),
        "category_credit_back": expected,
        "excluded_income": min(received, expected),
        "variance_line": var,
    }
