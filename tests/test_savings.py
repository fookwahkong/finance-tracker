from datetime import date

from core.savings import due_automatic_months, allocation_total_is_valid


def test_due_automatic_months_includes_only_reached_paydays():
    assert due_automatic_months(
        goal_created_at=date(2026, 5, 16),
        today=date(2026, 8, 11),
        payday=15,
    ) == ["2026-05", "2026-06", "2026-07"]


def test_allocation_total_rejects_more_than_100_percent():
    assert allocation_total_is_valid([55, 35], 10) is True
    assert allocation_total_is_valid([55, 35], 11) is False
