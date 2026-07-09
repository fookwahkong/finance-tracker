from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        {"id": "b1", "category": "Groceries", "amount": 400.0},
    ]
    svc.table.return_value.upsert.return_value.execute.return_value.data = [
        {"id": "b1", "category": "Groceries", "amount": 450.0},
    ]
    svc.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
        {"id": "b1", "category": "Groceries", "amount": 450.0},
    ]
    return svc


@pytest.fixture
def client(fake_supabase):
    from backend.deps import get_db
    from backend.main import app

    app.dependency_overrides[get_db] = lambda: fake_supabase
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_budgets(client):
    resp = client.get("/api/budgets")
    assert resp.status_code == 200
    assert resp.json()[0]["category"] == "Groceries"


def test_upsert_budget_returns_row(client, fake_supabase):
    resp = client.put("/api/budgets", json={"category": "Groceries", "amount": 450.0})
    assert resp.status_code == 200
    assert resp.json()["amount"] == 450.0
    sent = fake_supabase.table.return_value.upsert.call_args[0][0]
    assert sent == {"category": "Groceries", "amount": 450.0}


def test_delete_budget(client):
    resp = client.delete("/api/budgets/Groceries")
    assert resp.status_code == 204
