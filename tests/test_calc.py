from core.calc import month_range, monthly_summary


def test_month_range_mid_year():
    assert month_range("2026-06") == ("2026-06-01", "2026-07-01")


def test_month_range_december_rolls_over():
    assert month_range("2026-12") == ("2026-12-01", "2027-01-01")


def test_monthly_summary_totals_and_breakdown():
    rows = [
        {"amount": 3000.0, "category": "Income"},
        {"amount": -12.5, "category": "Food"},
        {"amount": -7.5, "category": "Food"},
        {"amount": -20.0, "category": None},
    ]
    result = monthly_summary(rows)
    assert result["total_income"] == 3000.0
    assert result["total_expenses"] == -40.0
    assert result["net"] == 2960.0
    assert result["breakdown"] == {"Income": 3000.0, "Food": -20.0, "Uncategorized": -20.0}
    assert "month" not in result


def test_monthly_summary_empty():
    result = monthly_summary([])
    assert result == {"total_income": 0, "total_expenses": 0, "net": 0, "breakdown": {}}
