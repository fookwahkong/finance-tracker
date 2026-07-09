from datetime import date

from backend.demo_seed import build_claims, seed_rows

CANONICAL = {
    "Groceries", "Food & Drink", "Transport", "Personal", "Pets", "Gym",
    "Shopping", "Education", "Car", "Housing", "Gifts", "Work",
    "Sports & Hobby", "Beauty", "Others", "Travel",
}


def test_seed_covers_expected_tables():
    rows = seed_rows("demo-uid", date(2026, 7, 9))
    for table in ["categories", "transactions", "budgets", "subscriptions",
                  "net_worth", "invest_transactions", "watchlist"]:
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
        {"id": "t4", "user_id": "demo-uid", "item": "Salary", "category": "Work",
         "amount": 5200.0, "date": "2026-07-25"},
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
