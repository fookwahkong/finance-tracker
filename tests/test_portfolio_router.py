import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

ROW = {
    "id": "t1", "ticker": "AAPL", "type": "BUY", "quantity": 10,
    "price_per_share": 150.0, "purchase_date": "2026-01-15",
    "created_at": "2026-01-15T00:00:00+00:00",
}


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.order.return_value.execute.return_value.data = [ROW]
    svc.table.return_value.insert.return_value.execute.return_value.data = [ROW]
    svc.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [ROW]
    svc.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [ROW]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setattr("backend.routers.investments.portfolio.supabase", fake_supabase)
    from backend.main import app
    return TestClient(app)


def test_list_transactions(client):
    resp = client.get("/api/investments/portfolio/transactions")
    assert resp.status_code == 200
    assert resp.json()[0]["ticker"] == "AAPL"


def test_create_transaction_uppercases_ticker(client, fake_supabase):
    resp = client.post("/api/investments/portfolio/transactions", json={
        "ticker": "aapl", "type": "BUY", "quantity": 10,
        "price_per_share": 150.0, "purchase_date": "2026-01-15",
    })
    assert resp.status_code == 200
    sent = fake_supabase.table.return_value.insert.call_args[0][0]
    assert sent["ticker"] == "AAPL"


def test_create_rejects_bad_type(client):
    resp = client.post("/api/investments/portfolio/transactions", json={
        "ticker": "AAPL", "type": "HOLD", "quantity": 10,
        "price_per_share": 150.0, "purchase_date": "2026-01-15",
    })
    assert resp.status_code == 422


def test_update_transaction(client, fake_supabase):
    resp = client.put("/api/investments/portfolio/transactions/t1", json={
        "ticker": "AAPL", "type": "SELL", "quantity": 5,
        "price_per_share": 180.0, "purchase_date": "2026-06-01",
    })
    assert resp.status_code == 200
    eq_args = fake_supabase.table.return_value.update.return_value.eq.call_args[0]
    assert eq_args == ("id", "t1")


def test_delete_transaction(client, fake_supabase):
    resp = client.delete("/api/investments/portfolio/transactions/t1")
    assert resp.status_code == 204


def test_delete_missing_returns_404(client, fake_supabase):
    fake_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = []
    resp = client.delete("/api/investments/portfolio/transactions/nope")
    assert resp.status_code == 404


WATCH_ROW = {"id": "w1", "ticker": "NVDA", "added_at": "2026-07-01T00:00:00+00:00"}


def test_list_watchlist(client, fake_supabase):
    fake_supabase.table.return_value.select.return_value.order.return_value.execute.return_value.data = [WATCH_ROW]
    resp = client.get("/api/investments/portfolio/watchlist")
    assert resp.status_code == 200
    assert resp.json()[0]["ticker"] == "NVDA"


def test_add_watchlist_uppercases(client, fake_supabase):
    fake_supabase.table.return_value.upsert.return_value.execute.return_value.data = [WATCH_ROW]
    resp = client.post("/api/investments/portfolio/watchlist", json={"ticker": "nvda"})
    assert resp.status_code == 200
    sent = fake_supabase.table.return_value.upsert.call_args[0][0]
    assert sent == {"ticker": "NVDA"}


def test_remove_watchlist(client, fake_supabase):
    fake_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [WATCH_ROW]
    resp = client.delete("/api/investments/portfolio/watchlist/NVDA")
    assert resp.status_code == 204
    eq_args = fake_supabase.table.return_value.delete.return_value.eq.call_args[0]
    assert eq_args == ("ticker", "NVDA")
