from core.investments.positions import build_positions, enrich_positions, portfolio_totals


def tx(ticker, type_, quantity, price, date):
    return {"ticker": ticker, "type": type_, "quantity": quantity, "price_per_share": price, "purchase_date": date}


def test_build_positions_aggregates_buys():
    p = build_positions([
        tx("AAPL", "BUY", 10, 100, "2026-01-01"),
        tx("AAPL", "BUY", 10, 200, "2026-02-01"),
    ])
    assert p == [{"ticker": "AAPL", "shares": 20, "costBasis": 3000, "avgCost": 150}]


def test_build_positions_sells_reduce_cost_basis_at_average():
    p = build_positions([
        tx("AAPL", "BUY", 10, 100, "2026-01-01"),
        tx("AAPL", "BUY", 10, 200, "2026-02-01"),
        tx("AAPL", "SELL", 5, 300, "2026-03-01"),
    ])
    assert p[0]["shares"] == 15
    assert p[0]["costBasis"] == 2250
    assert p[0]["avgCost"] == 150


def test_build_positions_drops_fully_sold_positions():
    p = build_positions([
        tx("AAPL", "BUY", 10, 100, "2026-01-01"),
        tx("AAPL", "SELL", 10, 120, "2026-02-01"),
        tx("MSFT", "BUY", 1, 400, "2026-02-01"),
    ])
    assert [x["ticker"] for x in p] == ["MSFT"]


def test_build_positions_applies_in_date_order_regardless_of_input_order():
    p = build_positions([
        tx("AAPL", "SELL", 5, 120, "2026-02-01"),
        tx("AAPL", "BUY", 10, 100, "2026-01-01"),
    ])
    assert p[0]["shares"] == 5
    assert p[0]["costBasis"] == 500


def test_enrich_positions_computes_value_day_change_total_return():
    pos = [{"ticker": "AAPL", "shares": 10, "costBasis": 1000, "avgCost": 100}]
    [p] = enrich_positions(pos, {"AAPL": {"c": 150, "pc": 140}})
    assert p["value"] == 1500
    assert p["dayChange"] == 100
    assert p["totalReturn"] == 500


def test_enrich_positions_returns_none_when_quote_missing():
    pos = [{"ticker": "AAPL", "shares": 10, "costBasis": 1000, "avgCost": 100}]
    [p] = enrich_positions(pos, {})
    assert p["price"] is None
    assert p["value"] is None
    assert p["dayChange"] is None
    assert p["totalReturn"] is None


def test_portfolio_totals_sums_enriched_positions():
    enriched = enrich_positions(
        [
            {"ticker": "AAPL", "shares": 10, "costBasis": 1000, "avgCost": 100},
            {"ticker": "MSFT", "shares": 2, "costBasis": 700, "avgCost": 350},
        ],
        {"AAPL": {"c": 150, "pc": 140}, "MSFT": {"c": 400, "pc": 410}},
    )
    t = portfolio_totals(enriched)
    assert t["value"] == 2300
    assert t["costBasis"] == 1700
    assert t["dayChange"] == 80
    assert t["totalReturn"] == 600
    assert round(t["totalReturnPct"], 1) == 35.3
    assert round(t["dayChangePct"], 2) == round((80 / 2220) * 100, 2)
    assert t["complete"] is True


def test_portfolio_totals_marks_incomplete_when_quote_missing():
    enriched = enrich_positions(
        [{"ticker": "AAPL", "shares": 10, "costBasis": 1000, "avgCost": 100}], {}
    )
    assert portfolio_totals(enriched)["complete"] is False
