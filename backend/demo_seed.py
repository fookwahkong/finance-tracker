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

# A past trip for the Travel tab. Offsets are days from the trip's first day;
# the flight is negative because it was booked well before departure — the
# case pure date-range membership misses and an 'include' override fixes.
DEMO_TRIP = {
    "name": "Osaka",
    "destination": "Japan",
    "days": 7,
    "ends_days_ago": 20,
}
_TRIP_FLIGHT = ("ANA flights to Osaka", "Travel", -880.00, "card", -35)
# (item, category, amount, source, day_offset)
_TRIP_TEMPLATES = [
    ("Namba hotel", "Travel", -640.00, "card", 0),
    ("Airport limousine bus", "Transport", -22.40, "cash", 0),
    ("Dotonbori street food", "Food & Drink", -31.20, "cash", 0),
    ("ICOCA card top-up", "Transport", -30.00, "cash", 1),
    ("Osaka Castle entry", "Personal", -12.80, "cash", 1),
    ("Kushikatsu dinner", "Food & Drink", -48.60, "card", 1),
    ("Konbini breakfast", "Food & Drink", -8.40, "cash", 2),
    ("Universal Studios ticket", "Personal", -118.00, "card", 2),
    ("Ramen at Ichiran", "Food & Drink", -19.90, "cash", 3),
    ("Shinsaibashi shopping", "Shopping", -164.00, "card", 3),
    ("Kyoto day trip train", "Transport", -41.50, "card", 4),
    ("Fushimi Inari matcha", "Food & Drink", -9.60, "cash", 4),
    ("Omiyage for the office", "Gifts", -56.00, "card", 5),
    ("Sushi omakase", "Food & Drink", -132.00, "card", 5),
    ("Airport train", "Transport", -18.20, "cash", 6),
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


def demo_trip_dates(today: date) -> tuple[date, date]:
    """The demo trip's inclusive start and end dates."""
    end = today - timedelta(days=DEMO_TRIP["ends_days_ago"])
    return end - timedelta(days=DEMO_TRIP["days"] - 1), end


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
    trip_start, trip_end = demo_trip_dates(today)
    transactions.append(
        {
            "date": (trip_start + timedelta(days=_TRIP_FLIGHT[4])).isoformat(),
            "item": _TRIP_FLIGHT[0],
            "category": _TRIP_FLIGHT[1],
            "amount": _TRIP_FLIGHT[2],
            "source": _TRIP_FLIGHT[3],
        }
    )
    for item, cat, amount, source, offset in _TRIP_TEMPLATES:
        transactions.append(
            {
                "date": (trip_start + timedelta(days=offset)).isoformat(),
                "item": item,
                "category": cat,
                "amount": amount,
                "source": source,
            }
        )
    transactions = owned(transactions)

    travel_groups = owned(
        [
            {
                "name": DEMO_TRIP["name"],
                "destination": DEMO_TRIP["destination"],
                "start_date": trip_start.isoformat(),
                "end_date": trip_end.isoformat(),
            }
        ]
    )

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
        "travel_groups": travel_groups,
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


def build_claim_participants(inserted_claims: list[dict]) -> list[dict]:
    """Create participant rows after Supabase assigns the claim IDs."""
    participants = []
    for claim in inserted_claims:
        total = float(claim["total"])
        owner_amount = float(claim["my_share"])
        expected = float(claim["expected"])
        participants.extend(
            [
                {
                    "user_id": claim["user_id"],
                    "claim_id": claim["id"],
                    "name": "You",
                    "is_owner": True,
                    "share_amount": owner_amount,
                    "share_percent": owner_amount / total * 100,
                },
                {
                    "user_id": claim["user_id"],
                    "claim_id": claim["id"],
                    "name": claim.get("counterparty") or "Someone",
                    "is_owner": False,
                    "share_amount": expected,
                    "share_percent": expected / total * 100,
                },
            ]
        )
    return participants


def build_travel_overrides(
    inserted_groups: list[dict], inserted_transactions: list[dict], today: date
) -> list[dict]:
    """Membership overrides for the demo trip, built once Supabase has assigned
    IDs. Demonstrates both directions the date range alone gets wrong:

    * the flights, booked five weeks before departure, are pulled in; and
    * the GIRO subscriptions that auto-debited while the user was away
      (Netflix, gym) are pushed out — they are not holiday spending.
    """
    if not inserted_groups:
        return []
    group = inserted_groups[0]
    start, end = demo_trip_dates(today)
    overrides = []
    for tx in inserted_transactions:
        tx_date = date.fromisoformat(tx["date"])
        in_range = start <= tx_date <= end
        if tx["item"] == _TRIP_FLIGHT[0] and not in_range:
            mode = "include"
        elif in_range and tx.get("source") == "giro":
            mode = "exclude"
        else:
            continue
        overrides.append(
            {
                "user_id": group["user_id"],
                "group_id": group["id"],
                "transaction_id": tx["id"],
                "mode": mode,
            }
        )
    return overrides
