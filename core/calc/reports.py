def monthly_summary(transactions: list[dict]) -> dict:
    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    total_expenses = sum(t["amount"] for t in transactions if t["amount"] < 0)
    breakdown: dict[str, float] = {}
    for t in transactions:
        cat = t.get("category") or "Uncategorized"
        breakdown[cat] = breakdown.get(cat, 0) + t["amount"]
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income + total_expenses,
        "breakdown": breakdown,
    }
