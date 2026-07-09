from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_service(monkeypatch):
    svc = MagicMock()
    # delete(...).eq(...).execute() and insert(...).execute() both no-op fine as MagicMock
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
