from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_finnhub():
    svc = MagicMock()
    svc.company_profile.return_value = {"name": "Apple Inc"}
    svc.company_news.return_value = [{"headline": "x"}]
    svc.earnings_calendar.return_value = {"earningsCalendar": []}
    return svc


@pytest.fixture
def client(monkeypatch, fake_finnhub):
    monkeypatch.setattr("backend.routers.investments.company.client", fake_finnhub)
    from backend.main import app

    return TestClient(app)


def test_profile_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/company/profile/AAPL")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Apple Inc"


def test_news_endpoint_passes_explicit_dates(client, fake_finnhub):
    resp = client.get("/api/investments/company/news/AAPL?from=2026-06-22&to=2026-06-29")
    assert resp.status_code == 200
    assert fake_finnhub.company_news.call_args[0] == ("AAPL", "2026-06-22", "2026-06-29")


def test_news_endpoint_defaults_dates_when_missing(client, fake_finnhub):
    resp = client.get("/api/investments/company/news/AAPL")
    assert resp.status_code == 200
    args = fake_finnhub.company_news.call_args[0]
    assert args[0] == "AAPL"
    assert len(args[1]) == 10 and len(args[2]) == 10  # two ISO date strings


def test_earnings_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/company/earnings/AAPL")
    assert resp.status_code == 200
    assert "earningsCalendar" in resp.json()


def test_profile_endpoint_maps_runtimeerror_to_502(client, fake_finnhub):
    fake_finnhub.company_profile.side_effect = RuntimeError("Finnhub down")
    resp = client.get("/api/investments/company/profile/AAPL")
    assert resp.status_code == 502
