import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        {"id": "n1", "month": "2026-03", "cash": 5000.0},
    ]
    svc.table.return_value.upsert.return_value.execute.return_value.data = [
        {"id": "n1", "month": "2026-03", "cash": 5200.0},
    ]
    svc.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
        {"id": "n1", "month": "2026-03", "cash": 5200.0},
    ]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setattr("backend.routers.networth.supabase", fake_supabase)
    from backend.main import app
    return TestClient(app)


def test_list_net_worth(client):
    resp = client.get("/api/networth")
    assert resp.status_code == 200
    assert resp.json()[0]["month"] == "2026-03"


def test_upsert_net_worth_returns_row(client, fake_supabase):
    resp = client.put("/api/networth", json={"month": "2026-03", "cash": 5200.0})
    assert resp.status_code == 200
    assert resp.json()["cash"] == 5200.0
    sent = fake_supabase.table.return_value.upsert.call_args[0][0]
    assert sent == {"month": "2026-03", "cash": 5200.0}


def test_delete_net_worth(client, fake_supabase):
    resp = client.delete("/api/networth/2026-03")
    assert resp.status_code == 204
    eq_args = fake_supabase.table.return_value.delete.return_value.eq.call_args[0]
    assert eq_args == ("month", "2026-03")
