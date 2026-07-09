from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from core.investments.ai import _extract_json


def test_extract_json_plain():
    assert _extract_json('{"bull": [], "bear": []}') == {"bull": [], "bear": []}


def test_extract_json_fenced():
    text = '```json\n{"bull": ["a"], "bear": ["b"]}\n```'
    assert _extract_json(text) == {"bull": ["a"], "bear": ["b"]}


@pytest.fixture
def fakes(monkeypatch):
    ai = MagicMock()
    ai.bull_bear.return_value = {"bull": ["growth"], "bear": ["valuation"]}
    finnhub = MagicMock()
    finnhub.company_profile.return_value = {"name": "Apple"}
    finnhub.company_news.return_value = [{"headline": "h1"}]
    fmp = MagicMock()
    fmp.ratios.return_value = [{"priceToEarningsRatio": 30}]
    monkeypatch.setattr("backend.routers.investments.ai.ai", ai)
    monkeypatch.setattr("backend.routers.investments.ai.finnhub", finnhub)
    monkeypatch.setattr("backend.routers.investments.ai.fmp", fmp)
    return ai


@pytest.fixture
def client(fakes):
    from backend.deps import enforce_ai_limit
    from backend.main import app

    app.dependency_overrides[enforce_ai_limit] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_post_bull_bear_generates(client, fakes):
    resp = client.post("/api/investments/ai/bull-bear/AAPL")
    assert resp.status_code == 200
    assert resp.json()["bull"] == ["growth"]
    # inputs were gathered and forwarded
    args = fakes.bull_bear.call_args[0]
    assert args[0] == "AAPL"


def test_get_bull_bear_peeks_cache_only(client, monkeypatch):
    monkeypatch.setattr(
        "backend.routers.investments.ai.cache.peek",
        lambda key, ttl: {"bull": ["cached"], "bear": []},
    )
    resp = client.get("/api/investments/ai/bull-bear/AAPL")
    assert resp.status_code == 200
    assert resp.json() == {"cached": True, "data": {"bull": ["cached"], "bear": []}}


def test_get_bull_bear_empty_cache(client, monkeypatch):
    monkeypatch.setattr("backend.routers.investments.ai.cache.peek", lambda key, ttl: None)
    resp = client.get("/api/investments/ai/bull-bear/AAPL")
    assert resp.json() == {"cached": False, "data": None}


def test_news_summary_fans_out_per_ticker(client, fakes):
    ai = fakes
    ai.news_summary.return_value = [{"ticker": "AAPL", "summary": "Calm quarter."}]
    resp = client.get("/api/investments/ai/news-summary", params={"tickers": "aapl,msft"})
    assert resp.status_code == 200
    assert resp.json()[0]["ticker"] == "AAPL"
    news_by = ai.news_summary.call_args[0][0]
    assert set(news_by.keys()) == {"AAPL", "MSFT"}


def test_news_summary_requires_tickers(client):
    resp = client.get("/api/investments/ai/news-summary", params={"tickers": ""})
    assert resp.status_code == 422
