"""Deterministic-ish fake data for the public demo account."""

from datetime import date, datetime, timedelta, timezone

from core.claims import expected_amount

CANONICAL_CATEGORIES = [
    "Groceries",
    "Food & Drink",
    "Transport",
    "Personal",
    "Pets",
    "Gym",
    "Shopping",
    "Education",
    "Car",
    "Housing",
    "Gifts",
    "Work",
    "Sports & Hobby",
    "Beauty",
    "Others",
    "Travel",
]

# (item, category, amount, source) templates spread across each month.
_TX_TEMPLATES = [
    ("Cold Storage groceries", "Groceries", -84.20, "card"),
    ("Kopitiam lunch", "Food & Drink", -6.80, "card"),
    ("MRT top-up", "Transport", -20.00, "card"),
    ("Netflix", "Personal", -19.98, "giro"),
    ("Gym membership", "Gym", -95.00, "giro"),
    ("Uniqlo", "Shopping", -59.90, "card"),
    ("Salary", "Work", 5200.00, "giro"),
    ("Pharmacy", "Personal", -23.40, "card"),
    ("Grab ride", "Transport", -14.50, "card"),
    ("Dinner with friends", "Food & Drink", -42.00, "card"),
]


def seed_rows(user_id: str, today: date) -> dict[str, list[dict]]:
    def owned(rows: list[dict]) -> list[dict]:
        return [{**r, "user_id": user_id} for r in rows]

    categories = owned([{"name": name} for name in CANONICAL_CATEGORIES])

    transactions: list[dict] = []
    for month_offset in range(6):  # current + 5 prior months
        anchor = date(today.year, today.month, 15) - timedelta(days=30 * month_offset)
        for i, (item, cat, amount, source) in enumerate(_TX_TEMPLATES):
            tx_date = anchor - timedelta(days=i)
            transactions.append(
                {
                    "date": tx_date.isoformat(),
                    "item": item,
                    "category": cat,
                    "amount": amount,
                    "source": source,
                }
            )
    transactions = owned(transactions)

    budgets = owned(
        [
            {"category": "Groceries", "amount": 500.0},
            {"category": "Food & Drink", "amount": 350.0},
            {"category": "Transport", "amount": 120.0},
            {"category": "Shopping", "amount": 200.0},
        ]
    )

    subscriptions = owned(
        [
            {
                "type": "bill",
                "item": "Netflix",
                "amount": 19.98,
                "category": "Personal",
                "source": "giro",
                "day_of_month": 5,
            },
            {
                "type": "bill",
                "item": "Gym",
                "amount": 95.0,
                "category": "Gym",
                "source": "giro",
                "day_of_month": 1,
            },
            {
                "type": "income",
                "item": "Salary",
                "amount": 5200.0,
                "category": "Work",
                "source": "giro",
                "day_of_month": 25,
            },
        ]
    )

    net_worth = owned(
        [
            {
                "month": (date(today.year, today.month, 1) - timedelta(days=30 * n)).strftime(
                    "%Y-%m"
                ),
                "cash": 12000.0 + 800 * (5 - n),
            }
            for n in range(6)
        ]
    )

    invest_transactions = owned(
        [
            {
                "ticker": "AAPL",
                "type": "BUY",
                "quantity": 10,
                "price_per_share": 180.0,
                "purchase_date": (today - timedelta(days=120)).isoformat(),
            },
            {
                "ticker": "VOO",
                "type": "BUY",
                "quantity": 5,
                "price_per_share": 430.0,
                "purchase_date": (today - timedelta(days=60)).isoformat(),
            },
        ]
    )

    watchlist = owned([{"ticker": "AAPL"}, {"ticker": "VOO"}, {"ticker": "NVDA"}])

    return {
        "categories": categories,
        "transactions": transactions,
        "budgets": budgets,
        "subscriptions": subscriptions,
        "net_worth": net_worth,
        "invest_transactions": invest_transactions,
        "watchlist": watchlist,
    }


def build_claims(inserted_transactions: list[dict]) -> list[dict]:
    """Given the *inserted* transaction rows (post-insert, so they carry `id`),
    turn the two most recent "Dinner with friends" debits into split-expense
    claims — one still open, one already settled — so the claims feature
    isn't empty for demo visitors."""
    dinners = sorted(
        (t for t in inserted_transactions if t["item"] == "Dinner with friends"),
        key=lambda t: t["date"],
        reverse=True,
    )
    if len(dinners) < 2:
        return []

    def claim(debit: dict, counterparty: str, status: str) -> dict:
        total = abs(debit["amount"])
        my_share = round(total / 2, 2)
        row = {
            "user_id": debit["user_id"],
            "debit_tx_id": debit["id"],
            "total": total,
            "my_share": my_share,
            "expected": expected_amount(total, my_share),
            "category": debit["category"],
            "counterparty": counterparty,
            "status": status,
        }
        if status == "settled":
            row["settled_at"] = datetime.now(timezone.utc).isoformat()
        return row

    return [
        claim(dinners[0], "Priya", "open"),
        claim(dinners[1], "Alex", "settled"),
    ]
