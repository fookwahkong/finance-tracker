from datetime import date

from backend.demo_seed import build_claim_participants, build_claims, seed_rows

CANONICAL = {
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
}


def test_seed_covers_expected_tables():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    for table in [
        "categories",
        "transactions",
        "budgets",
        "subscriptions",
        "net_worth",
        "invest_transactions",
        "watchlist",
    ]:
        assert rows[table], f"{table} should have seed rows"


def test_every_row_is_owned_by_the_demo_user():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    for table, items in rows.items():
        for row in items:
            assert row["user_id"] == "demo-uid", f"{table} row missing user_id"


def test_categories_are_the_16_canonical():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    names = {c["name"] for c in rows["categories"]}
    assert names == CANONICAL


def test_transactions_span_multiple_months():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    months = {t["date"][:7] for t in rows["transactions"]}
    assert len(months) >= 4


def test_seeded_transactions_include_two_dinners_to_claim():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    dinners = [t for t in rows["transactions"] if t["item"] == "Dinner with friends"]
    assert len(dinners) >= 2


def _dinner(tx_id, tx_date, amount=-42.0):
    return {
        "id": tx_id,
        "user_id": "demo-uid",
        "item": "Dinner with friends",
        "category": "Food & Drink",
        "amount": amount,
        "date": tx_date,
    }


def test_build_claims_picks_two_most_recent_dinners():
    transactions = [
        _dinner("t1", "2026-07-01"),
        _dinner("t2", "2026-06-01"),
        _dinner("t3", "2026-05-01"),
        {
            "id": "t4",
            "user_id": "demo-uid",
            "item": "Salary",
            "category": "Work",
            "amount": 5200.0,
            "date": "2026-07-25",
        },
    ]
    claims = build_claims(transactions)
    assert [c["debit_tx_id"] for c in claims] == ["t1", "t2"]


def test_build_claims_one_open_one_settled():
    transactions = [_dinner("t1", "2026-07-01"), _dinner("t2", "2026-06-01")]
    claims = build_claims(transactions)
    statuses = {c["status"] for c in claims}
    assert statuses == {"open", "settled"}
    settled = next(c for c in claims if c["status"] == "settled")
    assert "settled_at" in settled


def test_build_claims_share_is_below_total():
    transactions = [_dinner("t1", "2026-07-01"), _dinner("t2", "2026-06-01")]
    for c in build_claims(transactions):
        assert c["my_share"] < c["total"]
        assert c["expected"] == c["total"] - c["my_share"]


def test_build_claims_empty_when_fewer_than_two_dinners():
    assert build_claims([_dinner("t1", "2026-07-01")]) == []


def test_build_claim_participants_creates_an_owner_and_a_person():
    participants = build_claim_participants(
        [
            {
                "id": "claim-1",
                "user_id": "demo-uid",
                "total": 42,
                "my_share": 21,
                "expected": 21,
                "counterparty": "Priya",
            }
        ]
    )

    assert participants == [
        {
            "user_id": "demo-uid",
            "claim_id": "claim-1",
            "name": "You",
            "is_owner": True,
            "share_amount": 21,
            "share_percent": 50,
        },
        {
            "user_id": "demo-uid",
            "claim_id": "claim-1",
            "name": "Priya",
            "is_owner": False,
            "share_amount": 21,
            "share_percent": 50,
        },
    ]


def test_seed_rows_includes_one_travel_group_over_the_trip_dates():
    from datetime import date

    from backend.demo_seed import demo_trip_dates, seed_rows

    today = date(2026, 8, 19)
    rows = seed_rows("demo-user", today)
    start, end = demo_trip_dates(today)

    assert len(rows["travel_groups"]) == 1
    group = rows["travel_groups"][0]
    assert group["name"] == "Osaka"
    assert group["start_date"] == start.isoformat()
    assert group["end_date"] == end.isoformat()
    assert group["user_id"] == "demo-user"


def test_seed_rows_dates_the_flight_before_the_trip_starts():
    from datetime import date

    from backend.demo_seed import demo_trip_dates, seed_rows

    today = date(2026, 8, 19)
    start, _ = demo_trip_dates(today)
    flight = next(
        t for t in seed_rows("demo-user", today)["transactions"] if t["item"].startswith("ANA")
    )

    # The whole point of the include override: it is outside the range.
    assert flight["date"] < start.isoformat()


def test_build_travel_overrides_pulls_the_flight_in_and_pushes_giro_bills_out():
    from datetime import date, timedelta

    from backend.demo_seed import build_travel_overrides, demo_trip_dates

    today = date(2026, 8, 19)
    start, _ = demo_trip_dates(today)
    groups = [{"id": "g1", "user_id": "demo-user"}]
    transactions = [
        {"id": "flight", "item": "ANA flights to Osaka", "date": (start - timedelta(days=35)).isoformat(), "source": "card"},
        {"id": "hotel", "item": "Namba hotel", "date": start.isoformat(), "source": "card"},
        {"id": "netflix", "item": "Netflix", "date": (start + timedelta(days=2)).isoformat(), "source": "giro"},
        {"id": "gym-home", "item": "Gym membership", "date": (start - timedelta(days=60)).isoformat(), "source": "giro"},
    ]

    overrides = build_travel_overrides(groups, transactions, today)
    by_tx = {o["transaction_id"]: o["mode"] for o in overrides}

    assert by_tx["flight"] == "include"  # booked before departure
    assert by_tx["netflix"] == "exclude"  # auto-debited mid-trip, not holiday spend
    assert "hotel" not in by_tx  # plain date derivation already covers it
    assert "gym-home" not in by_tx  # outside the trip and staying outside
    assert all(o["group_id"] == "g1" for o in overrides)


def test_build_travel_overrides_is_empty_without_a_group():
    from datetime import date

    from backend.demo_seed import build_travel_overrides

    assert build_travel_overrides([], [{"id": "t1"}], date(2026, 8, 19)) == []
