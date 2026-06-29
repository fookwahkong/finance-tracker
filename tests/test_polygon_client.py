import httpx
import pytest
from core.investments import cache
from core.investments.providers.polygon import BASE_URL, PolygonClient


def _client_with_transport(handler):
    client = PolygonClient()
    client._http = httpx.Client(base_url=BASE_URL, transport=httpx.MockTransport(handler))
    return client


@pytest.fixture(autouse=True)
def _bypass_cache(monkeypatch):
    monkeypatch.setattr(cache, "get_or_fetch", lambda key, fetch_fn, ttl_seconds: fetch_fn())


def test_get_returns_parsed_json_and_sends_auth_header():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"status": "OK", "results": {"ticker": "AAPL"}})

    client = _client_with_transport(handler)
    data = client._get("/v3/reference/tickers/AAPL")

    assert data == {"status": "OK", "results": {"ticker": "AAPL"}}
    assert seen["url"] == "https://api.polygon.io/v3/reference/tickers/AAPL"
    assert seen["auth"] == "Bearer test-polygon-key"


def test_get_raises_runtimeerror_on_http_error():
    def handler(request):
        return httpx.Response(404, json={"status": "NOT_FOUND"})

    client = _client_with_transport(handler)
    with pytest.raises(RuntimeError, match="Polygon request failed"):
        client._get("/v3/reference/tickers/NOPE")


def test_get_raises_on_error_status_payload():
    def handler(request):
        return httpx.Response(200, json={"status": "ERROR", "error": "rate limit"})

    client = _client_with_transport(handler)
    with pytest.raises(RuntimeError, match="error payload"):
        client._get("/v3/reference/tickers/AAPL")


def test_ticker_details_hits_reference_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"results": {"name": "Apple Inc."}})

    client = _client_with_transport(handler)
    data = client.ticker_details("AAPL")
    assert data["results"]["name"] == "Apple Inc."
    assert seen["path"] == "/v3/reference/tickers/AAPL"


def test_aggregates_builds_range_path():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"results": [{"c": 1}, {"c": 2}]})

    client = _client_with_transport(handler)
    data = client.aggregates("AAPL", "2026-05-01", "2026-06-01")
    assert len(data["results"]) == 2
    assert seen["path"] == "/v2/aggs/ticker/AAPL/range/1/day/2026-05-01/2026-06-01"


def test_dividends_hits_reference_dividends_with_ticker_param():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["ticker"] = request.url.params.get("ticker")
        return httpx.Response(200, json={"results": [{"cash_amount": 0.24}]})

    client = _client_with_transport(handler)
    data = client.dividends("AAPL")
    assert data["results"][0]["cash_amount"] == 0.24
    assert seen["path"] == "/v3/reference/dividends"
    assert seen["ticker"] == "AAPL"


def test_sma_hits_indicator_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"results": {"values": [{"value": 190.1}]}})

    client = _client_with_transport(handler)
    data = client.sma("AAPL")
    assert data["results"]["values"][0]["value"] == 190.1
    assert seen["path"] == "/v1/indicators/sma/AAPL"
