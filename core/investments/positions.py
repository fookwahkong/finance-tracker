"""Portfolio math over invest_transactions rows + live quotes.

Average-cost method: a SELL removes shares at the running average cost.
Mirrors frontend/src/pages/Investments/lib/portfolio.js.
"""


def build_positions(transactions: list[dict]) -> list[dict]:
    sorted_tx = sorted(transactions, key=lambda t: t["purchase_date"])
    positions: dict[str, dict] = {}
    for t in sorted_tx:
        p = positions.setdefault(t["ticker"], {"ticker": t["ticker"], "shares": 0, "costBasis": 0})
        qty = t["quantity"]
        if t["type"] == "BUY":
            p["shares"] += qty
            p["costBasis"] += qty * t["price_per_share"]
        else:
            avg = p["costBasis"] / p["shares"] if p["shares"] > 0 else 0
            p["shares"] -= qty
            p["costBasis"] -= qty * avg
            if p["shares"] <= 1e-9:
                p["shares"] = 0
                p["costBasis"] = 0

    result = []
    for p in positions.values():
        if p["shares"] <= 0:
            continue
        result.append({**p, "avgCost": p["costBasis"] / p["shares"]})
    return result


def enrich_positions(positions: list[dict], quotes: dict) -> list[dict]:
    enriched = []
    for p in positions:
        q = quotes.get(p["ticker"])
        price = q["c"] if q else None
        prev_close = q["pc"] if q else None
        value = p["shares"] * price if price is not None else None
        day_change = (price - prev_close) * p["shares"] if price is not None and prev_close is not None else None
        total_return = value - p["costBasis"] if value is not None else None
        enriched.append({
            **p,
            "price": price,
            "value": value,
            "dayChange": day_change,
            "totalReturn": total_return,
        })
    return enriched


def portfolio_totals(enriched: list[dict]) -> dict:
    priced = [p for p in enriched if p["value"] is not None]
    value = sum(p["value"] for p in priced)
    cost_basis = sum(p["costBasis"] for p in priced)
    day_change = sum(p["dayChange"] or 0 for p in priced)
    prev_value = value - day_change
    return {
        "value": value,
        "costBasis": cost_basis,
        "dayChange": day_change,
        "dayChangePct": (day_change / prev_value * 100) if prev_value else 0,
        "totalReturn": value - cost_basis,
        "totalReturnPct": ((value - cost_basis) / cost_basis * 100) if cost_basis else 0,
        "complete": len(priced) == len(enriched),
    }
