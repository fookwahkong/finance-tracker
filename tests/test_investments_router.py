from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_polygon():
    svc = MagicMock()
    svc.ticker_details.return_value = {"results": {"ticker": "AAPL", "name": "Apple Inc."}}
    svc.aggregates.return_value = {"results": [{"c": 1}, {"c": 2}]}
    svc.dividends.return_value = {"results": [{"cash_amount": 0.24}]}
    svc.sma.return_value = {"results": {"values": [{"value": 190.1}]}}
    return svc


@pytest.fixture
def client(monkeypatch, fake_polygon):
    monkeypatch.setattr("backend.routers.investments.market.client", fake_polygon)
    from backend.main import app

    return TestClient(app)


@pytest.fixture
def fake_finnhub():
    svc = MagicMock()
    svc.quote.return_value = {"c": 190.5, "pc": 188.0, "d": 2.5, "dp": 1.33}
    svc.market_news.return_value = [{"headline": "Markets rally"}]
    svc.earnings_calendar_range.return_value = {"earningsCalendar": [{"symbol": "AAPL"}]}
    return svc


@pytest.fixture
def client_fh(monkeypatch, fake_polygon, fake_finnhub):
    monkeypatch.setattr("backend.routers.investments.market.client", fake_polygon)
    monkeypatch.setattr("backend.routers.investments.market.finnhub", fake_finnhub)
    from backend.main import app

    return TestClient(app)


def test_quote_endpoint_returns_raw_payload(client_fh):
    resp = client_fh.get("/api/investments/market/quote/AAPL")
    assert resp.status_code == 200
    assert resp.json()["c"] == 190.5


def test_market_news_endpoint(client_fh):
    resp = client_fh.get("/api/investments/market/news")
    assert resp.status_code == 200
    assert resp.json()[0]["headline"] == "Markets rally"


def test_earnings_calendar_endpoint_defaults_to_next_two_weeks(client_fh, fake_finnhub):
    resp = client_fh.get("/api/investments/market/earnings-calendar")
    assert resp.status_code == 200
    args = fake_finnhub.earnings_calendar_range.call_args[0]
    assert len(args[0]) == 10 and len(args[1]) == 10  # two ISO dates


def test_ticker_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/market/ticker/aapl")
    assert resp.status_code == 200
    assert resp.json()["results"]["name"] == "Apple Inc."


def test_aggregates_endpoint_passes_date_range(client, fake_polygon):
    resp = client.get("/api/investments/market/aggregates/AAPL?from=2026-05-01&to=2026-06-01")
    assert resp.status_code == 200
    assert fake_polygon.aggregates.call_args[0] == ("AAPL", "2026-05-01", "2026-06-01")


def test_aggregates_endpoint_defaults_dates_when_missing(client, fake_polygon):
    resp = client.get("/api/investments/market/aggregates/AAPL")
    assert resp.status_code == 200
    # symbol passed, plus two ISO date strings
    args = fake_polygon.aggregates.call_args[0]
    assert args[0] == "AAPL"
    assert len(args[1]) == 10 and len(args[2]) == 10


def test_dividends_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/market/dividends/AAPL")
    assert resp.status_code == 200
    assert resp.json()["results"][0]["cash_amount"] == 0.24


def test_sma_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/market/sma/AAPL")
    assert resp.status_code == 200
    assert resp.json()["results"]["values"][0]["value"] == 190.1
