from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_service(monkeypatch):
    svc = MagicMock()
    tables = {}

    def fake_table(name):
        if name not in tables:
            tbl = MagicMock()
            if name == "transactions":
                tbl.insert.return_value.execute.return_value.data = [
                    {
                        "id": "t1",
                        "user_id": "demo-uid",
                        "item": "Dinner with friends",
                        "category": "Food & Drink",
                        "amount": -42.0,
                        "date": "2026-07-01",
                    },
                    {
                        "id": "t2",
                        "user_id": "demo-uid",
                        "item": "Dinner with friends",
                        "category": "Food & Drink",
                        "amount": -42.0,
                        "date": "2026-06-01",
                    },
                ]
            tables[name] = tbl
        return tables[name]

    svc.table.side_effect = fake_table
    monkeypatch.setattr("backend.routers.demo.supabase", svc)
    return svc


@pytest.fixture
def client(fake_service, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "test-cron-secret")
    monkeypatch.setenv("DEMO_USER_ID", "demo-uid")
    from backend.main import app

    return TestClient(app)


def test_reset_requires_cron_secret(client):
    resp = client.get("/api/demo/reset")
    assert resp.status_code in (401, 422)


def test_reset_wipes_then_seeds(client, fake_service):
    resp = client.get("/api/demo/reset", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json()["reset"] is True
    # It deleted from and inserted into the demo tables.
    assert fake_service.table.call_count > 0


def test_reset_seeds_claims_from_inserted_transactions(client, fake_service):
    resp = client.get("/api/demo/reset", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json()["counts"]["claims"] == 2
    inserted = fake_service.table("claims").insert.call_args[0][0]
    assert {c["debit_tx_id"] for c in inserted} == {"t1", "t2"}
