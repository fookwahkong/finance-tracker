import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_fx():
    svc = MagicMock()
    svc.usd_sgd.return_value = {"rate": 1.34, "date": "2026-07-01"}
    return svc


@pytest.fixture
def client(monkeypatch, fake_fx):
    monkeypatch.setattr("backend.routers.investments.fx.client", fake_fx)
    from backend.main import app
    return TestClient(app)


def test_usd_sgd_returns_rate(client):
    resp = client.get("/api/investments/fx/usd-sgd")
    assert resp.status_code == 200
    assert resp.json() == {"rate": 1.34, "date": "2026-07-01"}


def test_usd_sgd_maps_runtime_error_to_502(client, fake_fx):
    fake_fx.usd_sgd.side_effect = RuntimeError("boom")
    resp = client.get("/api/investments/fx/usd-sgd")
    assert resp.status_code == 502
