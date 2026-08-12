def budget_status(spend: float, budget: float) -> str:
    if not budget or budget <= 0:
        return "on"
    if spend > budget:
        return "over"
    if spend >= 0.8 * budget:
        return "watch"
    return "on"
