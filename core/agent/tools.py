"""Read-only tool registry for the chat agent (ai-agent.md phase 1).

Each tool's `run(db, **input)` is executed inline by the orchestrator's
tool-use loop. `db` is the request-scoped RLS client, so every tool is
naturally scoped to the calling user.
"""

from datetime import date, timedelta

from core.calc import budget_status, month_range, monthly_summary
from core.investments.positions import build_positions, enrich_positions, portfolio_totals
from core.investments.providers.finnhub import FinnhubClient
from core.investments.providers.fmp import FMPClient
from core.savings import goal_progress

finnhub = FinnhubClient()
fmp = FMPClient()


def _get_spending_summary(db, month: str) -> dict:
    start, end = month_range(month)
    rows = db.table("transactions").select("*").gte("date", start).lt("date", end).execute().data
    return {"month": month, **monthly_summary(rows)}


def _get_budget_status(db, month: str | None = None) -> list[dict]:
    month = month or date.today().strftime("%Y-%m")
    budgets = db.table("budgets").select("*").order("category").execute().data
    start, end = month_range(month)
    tx_rows = db.table("transactions").select("*").gte("date", start).lt("date", end).execute().data
    breakdown = monthly_summary(tx_rows)["breakdown"]
    result = []
    for b in budgets:
        spend = -breakdown.get(b["category"], 0)
        result.append({
            "category": b["category"],
            "spend": spend,
            "budget": b["amount"],
            "status": budget_status(spend, b["amount"]),
        })
    return result


def _get_savings_goal_progress(db) -> list[dict]:
    goals = db.table("saving_goals").select("*").order("created_at").execute().data
    contributions = db.table("saving_contributions").select("*").order("created_at").execute().data
    return goal_progress(goals, contributions)


def _analyze_stock(db, symbol: str) -> dict:
    symbol = symbol.upper()
    profile = finnhub.company_profile(symbol)
    ratios = fmp.ratios(symbol)
    to = date.today().isoformat()
    from_ = (date.today() - timedelta(days=7)).isoformat()
    news = finnhub.company_news(symbol, from_, to)
    return {
        "symbol": symbol,
        "profile": profile,
        "ratios": ratios[:5],
        "news": [n.get("headline", "") for n in news[:10]],
    }


def _get_portfolio_holdings(db) -> dict:
    transactions = db.table("invest_transactions").select("*").order("purchase_date").execute().data
    positions = build_positions(transactions)
    quotes = {p["ticker"]: finnhub.quote(p["ticker"]) for p in positions}
    enriched = enrich_positions(positions, quotes)
    return {"holdings": enriched, "totals": portfolio_totals(enriched)}


TOOLS = {
    "get_spending_summary": {
        "description": "Get total income, total expenses, net, and per-category breakdown for a given month.",
        "input_schema": {
            "type": "object",
            "properties": {"month": {"type": "string", "description": "YYYY-MM"}},
            "required": ["month"],
        },
        "run": _get_spending_summary,
    },
    "get_budget_status": {
        "description": (
            "Get each category's actual spend vs its monthly budget, with an on/watch/over status, "
            "for a given month (defaults to the current month)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"month": {"type": "string", "description": "YYYY-MM, defaults to current month"}},
            "required": [],
        },
        "run": _get_budget_status,
    },
    "get_savings_goal_progress": {
        "description": "Get each savings goal's target, amount contributed so far, and progress percentage.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
        "run": _get_savings_goal_progress,
    },
    "analyze_stock": {
        "description": (
            "Get a stock's company profile, financial ratios, and recent headlines for analysis. "
            "Does not generate an opinion itself — reason over the returned data to answer the user."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"symbol": {"type": "string", "description": "Stock ticker, e.g. AAPL"}},
            "required": ["symbol"],
        },
        "run": _analyze_stock,
    },
    "get_portfolio_holdings": {
        "description": "Get current portfolio holdings (shares, cost basis, live value, return) and totals.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
        "run": _get_portfolio_holdings,
    },
}
