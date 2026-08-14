from datetime import date

from core.savings import allocation_total_is_valid, due_automatic_months, goal_progress


def test_due_automatic_months_includes_only_reached_paydays():
    assert due_automatic_months(
        goal_created_at=date(2026, 5, 16),
        today=date(2026, 8, 11),
        payday=15,
    ) == ["2026-05", "2026-06", "2026-07"]


def test_allocation_total_rejects_more_than_100_percent():
    assert allocation_total_is_valid([55, 35], 10) is True
    assert allocation_total_is_valid([55, 35], 11) is False


def test_goal_progress_sums_contributions_per_goal():
    goals = [
        {"id": "g1", "name": "Emergency Fund", "target_amount": 1000},
        {"id": "g2", "name": "Vacation", "target_amount": 500},
    ]
    contributions = [
        {"goal_id": "g1", "amount": 100},
        {"goal_id": "g1", "amount": 150},
        {"goal_id": "g2", "amount": 50},
    ]
    assert goal_progress(goals, contributions) == [
        {
            "goal_id": "g1",
            "name": "Emergency Fund",
            "target_amount": 1000,
            "contributed": 250,
            "progress_pct": 25.0,
        },
        {
            "goal_id": "g2",
            "name": "Vacation",
            "target_amount": 500,
            "contributed": 50,
            "progress_pct": 10.0,
        },
    ]


def test_goal_progress_zero_contributions():
    goals = [{"id": "g1", "name": "Emergency Fund", "target_amount": 1000}]
    assert goal_progress(goals, []) == [
        {
            "goal_id": "g1",
            "name": "Emergency Fund",
            "target_amount": 1000,
            "contributed": 0,
            "progress_pct": 0.0,
        },
    ]
