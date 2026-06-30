"""Pure, DB-free settlement math for shared-expense claims.

A claim's effect at settle reduces to subtracting `min(received, expected)`
from both the claim category's spending and from income, in the debit's month.
Gift income (variance > 0) and absorbed shortfall (variance < 0) emerge from
the residual real rows. See docs/superpowers/specs/2026-06-30-shared-expense-claims-design.md.
"""


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
