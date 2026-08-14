from unittest.mock import MagicMock

from core.agent.tools import TOOLS


def make_db(tables: dict):
    db = MagicMock()

    def table(name):
        m = MagicMock()
        m.select.return_value = m
        m.order.return_value = m
        m.gte.return_value = m
        m.lt.return_value = m
        m.eq.return_value = m
        m.limit.return_value = m
        m.execute.return_value.data = tables.get(name, [])
        return m

    db.table.side_effect = table
    return db


def test_get_spending_summary_wraps_monthly_summary():
    db = make_db(
        {
            "transactions": [
                {"amount": 3000.0, "category": "Income"},
                {"amount": -20.0, "category": "Food"},
            ]
        }
    )
    result = TOOLS["get_spending_summary"]["run"](db, month="2026-08")
    assert result["month"] == "2026-08"
    assert result["total_income"] == 3000.0
    assert result["breakdown"] == {"Income": 3000.0, "Food": -20.0}


def test_get_budget_status_classifies_each_category():
    db = make_db(
        {
            "budgets": [{"category": "Food", "amount": 100.0}],
            "transactions": [{"amount": -120.0, "category": "Food"}],
        }
    )
    result = TOOLS["get_budget_status"]["run"](db, month="2026-08")
    assert result == [{"category": "Food", "spend": 120.0, "budget": 100.0, "status": "over"}]


def test_get_budget_status_defaults_to_current_month_when_omitted():
    db = make_db({"budgets": [], "transactions": []})
    result = TOOLS["get_budget_status"]["run"](db, month=None)
    assert result == []


def test_get_savings_goal_progress_joins_goals_and_contributions():
    db = make_db(
        {
            "saving_goals": [{"id": "g1", "name": "Emergency Fund", "target_amount": 1000}],
            "saving_contributions": [{"goal_id": "g1", "amount": 250}],
        }
    )
    result = TOOLS["get_savings_goal_progress"]["run"](db)
    assert result == [
        {
            "goal_id": "g1",
            "name": "Emergency Fund",
            "target_amount": 1000,
            "contributed": 250,
            "progress_pct": 25.0,
        }
    ]


def test_analyze_stock_returns_raw_data_no_llm_call(monkeypatch):
    finnhub = MagicMock()
    finnhub.company_profile.return_value = {"name": "Apple"}
    finnhub.company_news.return_value = [{"headline": "h1"}]
    fmp = MagicMock()
    fmp.ratios.return_value = [{"priceToEarningsRatio": 30}]
    monkeypatch.setattr("core.agent.tools.finnhub", finnhub)
    monkeypatch.setattr("core.agent.tools.fmp", fmp)

    result = TOOLS["analyze_stock"]["run"](None, symbol="aapl")

    assert result["symbol"] == "AAPL"
    assert result["profile"] == {"name": "Apple"}
    assert result["ratios"] == [{"priceToEarningsRatio": 30}]
    assert result["news"] == ["h1"]


def test_get_portfolio_holdings_prices_positions(monkeypatch):
    db = make_db(
        {
            "invest_transactions": [
                {
                    "ticker": "AAPL",
                    "type": "BUY",
                    "quantity": 10,
                    "price_per_share": 100,
                    "purchase_date": "2026-01-01",
                },
            ]
        }
    )
    finnhub = MagicMock()
    finnhub.quote.return_value = {"c": 150, "pc": 140}
    monkeypatch.setattr("core.agent.tools.finnhub", finnhub)

    result = TOOLS["get_portfolio_holdings"]["run"](db)

    assert result["holdings"][0]["ticker"] == "AAPL"
    assert result["holdings"][0]["value"] == 1500
    assert result["totals"]["value"] == 1500
    assert result["totals"]["complete"] is True
