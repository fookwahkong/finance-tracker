from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        {
            "id": "s1",
            "type": "bill",
            "item": "Spotify",
            "amount": 12.0,
            "category": "Personal",
            "source": "card",
            "day_of_month": 25,
        },
    ]
    svc.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "s2",
            "type": "income",
            "item": "Salary",
            "amount": 3000.0,
            "category": "Work",
            "source": "giro",
            "day_of_month": 1,
        },
    ]
    svc.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "s1",
            "type": "bill",
            "item": "Spotify",
            "amount": 13.0,
            "category": "Personal",
            "source": "card",
            "day_of_month": 25,
        },
    ]
    svc.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
        {"id": "s1"},
    ]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setattr("backend.routers.subscriptions.supabase", fake_supabase)
    from backend.main import app

    return TestClient(app)


def test_list_subscriptions(client):
    resp = client.get("/api/subscriptions")
    assert resp.status_code == 200
    assert resp.json()[0]["item"] == "Spotify"


def test_create_subscription_returns_row(client, fake_supabase):
    resp = client.post(
        "/api/subscriptions",
        json={
            "type": "income",
            "item": "Salary",
            "amount": 3000.0,
            "category": "Work",
            "source": "giro",
            "day_of_month": 1,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["item"] == "Salary"
    sent = fake_supabase.table.return_value.insert.call_args[0][0]
    assert sent["type"] == "income" and sent["amount"] == 3000.0


def test_update_subscription_returns_row(client):
    resp = client.put(
        "/api/subscriptions/s1",
        json={
            "type": "bill",
            "item": "Spotify",
            "amount": 13.0,
            "category": "Personal",
            "source": "card",
            "day_of_month": 25,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 13.0


def test_delete_subscription(client):
    resp = client.delete("/api/subscriptions/s1")
    assert resp.status_code == 204
