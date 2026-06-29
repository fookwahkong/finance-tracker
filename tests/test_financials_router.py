import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_fmp():
    svc = MagicMock()
    svc.income_statement.return_value = [{"revenue": 1}]
    svc.balance_sheet.return_value = [{"totalAssets": 2}]
    svc.cash_flow.return_value = [{"netIncome": 3}]
    return svc


@pytest.fixture
def client(monkeypatch, fake_fmp):
    monkeypatch.setattr("backend.routers.investments.financials.client", fake_fmp)
    from backend.main import app
    return TestClient(app)


def test_income_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/financials/income/AAPL")
    assert resp.status_code == 200
    assert resp.json() == [{"revenue": 1}]


def test_balance_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/financials/balance/AAPL")
    assert resp.status_code == 200
    assert resp.json() == [{"totalAssets": 2}]


def test_cashflow_endpoint_returns_raw_payload(client):
    resp = client.get("/api/investments/financials/cashflow/AAPL")
    assert resp.status_code == 200
    assert resp.json() == [{"netIncome": 3}]


def test_income_endpoint_maps_runtimeerror_to_502(client, fake_fmp):
    fake_fmp.income_statement.side_effect = RuntimeError("FMP down")
    resp = client.get("/api/investments/financials/income/AAPL")
    assert resp.status_code == 502
