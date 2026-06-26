import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_polygon():
    svc = MagicMock()
    svc.ticker_details.return_value = {"results": {"ticker": "AAPL", "name": "Apple Inc."}}
    svc.previous_close.return_value = {"results": [{"c": 195.0, "o": 190.0}]}
    svc.aggregates.return_value = {"results": [{"c": 1}, {"c": 2}]}
    return svc


@pytest.fixture
def client(monkeypatch, fake_polygon):
    monkeypatch.setattr("backend.routers.investments.market.client", fake_polygon)
    from backend.main import app
    return TestClient(app)


def test_ticker_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/market/ticker/aapl")
    assert resp.status_code == 200
    assert resp.json()["results"]["name"] == "Apple Inc."


def test_prev_close_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/market/prev-close/AAPL")
    assert resp.status_code == 200
    assert resp.json()["results"][0]["c"] == 195.0


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
