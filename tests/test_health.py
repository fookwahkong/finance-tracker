from fastapi.testclient import TestClient

import backend.main as main
from backend.main import app

client = TestClient(app)


def test_health_liveness():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_ready_ok(monkeypatch):
    monkeypatch.setattr(main, "db_ping", lambda: True)
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_ready_unavailable(monkeypatch):
    monkeypatch.setattr(main, "db_ping", lambda: False)
    resp = client.get("/health/ready")
    assert resp.status_code == 503
    assert resp.json() == {"status": "unavailable"}
