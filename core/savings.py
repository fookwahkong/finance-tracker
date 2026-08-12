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


def goal_progress(goals: list[dict], contributions: list[dict]) -> list[dict]:
    contributed_by_goal: dict[str, float] = {}
    for c in contributions:
        contributed_by_goal[c["goal_id"]] = contributed_by_goal.get(c["goal_id"], 0) + c["amount"]

    result = []
    for goal in goals:
        target = goal["target_amount"]
        contributed = contributed_by_goal.get(goal["id"], 0)
        result.append({
            "goal_id": goal["id"],
            "name": goal["name"],
            "target_amount": target,
            "contributed": contributed,
            "progress_pct": (contributed / target * 100) if target else 0.0,
        })
    return result
