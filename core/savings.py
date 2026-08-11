from datetime import date


def due_automatic_months(goal_created_at: date, today: date, payday: int) -> list[str]:
    """Return contribution months whose selected payday has arrived."""
    months = []
    year, month = goal_created_at.year, goal_created_at.month
    while (year, month) <= (today.year, today.month):
        if (year, month) < (today.year, today.month) or today.day >= payday:
            months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return months


def allocation_total_is_valid(existing_percentages: list[float], new_percentage: float) -> bool:
    return sum(existing_percentages) + new_percentage <= 100
