import httpx
import pytest

from core.investments import cache
from core.investments.providers.finnhub import BASE_URL, FinnhubClient


@pytest.fixture(autouse=True)
def _bypass_cache(monkeypatch):
    monkeypatch.setattr(cache, "get_or_fetch", lambda key, fetch_fn, ttl_seconds: fetch_fn())


def _client_with_transport(handler):
    client = FinnhubClient()
    client._http = httpx.Client(base_url=BASE_URL, transport=httpx.MockTransport(handler))
    return client


def test_get_sends_token_header():
    seen = {}

    def handler(request):
        seen["token"] = request.headers.get("x-finnhub-token")
        return httpx.Response(200, json={"name": "Apple Inc"})

    client = _client_with_transport(handler)
    client._get("/stock/profile2", {"symbol": "AAPL"})
    assert seen["token"] == "test-finnhub-key"


def test_get_raises_on_error_payload():
    def handler(request):
        return httpx.Response(200, json={"error": "API limit reached"})

    client = _client_with_transport(handler)
    with pytest.raises(RuntimeError, match="error payload"):
        client._get("/stock/profile2", {"symbol": "AAPL"})


def test_company_profile_hits_endpoint_with_symbol():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["symbol"] = request.url.params.get("symbol")
        return httpx.Response(200, json={"name": "Apple Inc"})

    client = _client_with_transport(handler)
    client.company_profile("aapl")
    assert seen["path"] == "/api/v1/stock/profile2"
    assert seen["symbol"] == "AAPL"


def test_company_news_passes_date_range_and_returns_list():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["from"] = request.url.params.get("from")
        seen["to"] = request.url.params.get("to")
        return httpx.Response(200, json=[{"headline": "x"}])

    client = _client_with_transport(handler)
    data = client.company_news("AAPL", "2026-06-22", "2026-06-29")
    assert data == [{"headline": "x"}]
    assert seen["path"] == "/api/v1/company-news"
    assert seen["from"] == "2026-06-22"
    assert seen["to"] == "2026-06-29"


def test_market_news_uses_general_category():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["category"] = request.url.params.get("category")
        return httpx.Response(200, json=[{"headline": "Markets rally"}])

    client = _client_with_transport(handler)
    data = client.market_news()
    assert data == [{"headline": "Markets rally"}]
    assert seen["path"] == "/api/v1/news"
    assert seen["category"] == "general"


def test_earnings_calendar_range_passes_dates():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["from"] = request.url.params.get("from")
        seen["to"] = request.url.params.get("to")
        return httpx.Response(200, json={"earningsCalendar": []})

    client = _client_with_transport(handler)
    client.earnings_calendar_range("2026-07-02", "2026-07-16")
    assert seen["path"] == "/api/v1/calendar/earnings"
    assert seen["from"] == "2026-07-02"
    assert seen["to"] == "2026-07-16"


def test_quote_hits_endpoint_and_uppercases():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["symbol"] = request.url.params.get("symbol")
        return httpx.Response(200, json={"c": 190.5, "pc": 188.0})

    client = _client_with_transport(handler)
    data = client.quote("aapl")
    assert data == {"c": 190.5, "pc": 188.0}
    assert seen["path"] == "/api/v1/quote"
    assert seen["symbol"] == "AAPL"


def test_earnings_calendar_hits_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"earningsCalendar": []})

    client = _client_with_transport(handler)
    client.earnings_calendar("AAPL")
    assert seen["path"] == "/api/v1/calendar/earnings"
