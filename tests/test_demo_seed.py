from datetime import date

from backend.demo_seed import seed_rows

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
