import httpx
import pytest

from core.investments import cache
from core.investments.providers.fmp import BASE_URL, FMPClient


@pytest.fixture(autouse=True)
def _bypass_cache(monkeypatch):
    monkeypatch.setattr(cache, "get_or_fetch", lambda key, fetch_fn, ttl_seconds: fetch_fn())


def _client_with_transport(handler):
    client = FMPClient()
    client._http = httpx.Client(base_url=BASE_URL, transport=httpx.MockTransport(handler))
    return client


def test_get_sends_apikey_and_returns_list():
    seen = {}

    def handler(request):
        seen["apikey"] = request.url.params.get("apikey")
        return httpx.Response(200, json=[{"date": "2025-12-31", "revenue": 1}])

    client = _client_with_transport(handler)
    data = client._get("/income-statement/AAPL")
    assert data == [{"date": "2025-12-31", "revenue": 1}]
    assert seen["apikey"] == "test-fmp-key"


def test_get_raises_on_error_message_payload():
    def handler(request):
        return httpx.Response(200, json={"Error Message": "Limit Reach"})

    client = _client_with_transport(handler)
    with pytest.raises(RuntimeError, match="error payload"):
        client._get("/income-statement/AAPL")


def test_income_statement_hits_endpoint_and_uppercases():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json=[{"revenue": 1}])

    client = _client_with_transport(handler)
    data = client.income_statement("aapl")
    assert data == [{"revenue": 1}]
    assert seen["path"] == "/api/v3/income-statement/AAPL"


def test_balance_sheet_hits_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json=[{"totalAssets": 1}])

    client = _client_with_transport(handler)
    client.balance_sheet("AAPL")
    assert seen["path"] == "/api/v3/balance-sheet-statement/AAPL"


def test_cash_flow_hits_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json=[{"netIncome": 1}])

    client = _client_with_transport(handler)
    client.cash_flow("AAPL")
    assert seen["path"] == "/api/v3/cash-flow-statement/AAPL"
