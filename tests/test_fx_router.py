from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_fx():
    svc = MagicMock()
    svc.rate.return_value = {"rate": 1.34, "date": "2026-07-01"}
    return svc


@pytest.fixture
def client(monkeypatch, fake_fx):
    monkeypatch.setattr("backend.routers.fx.client", fake_fx)
    from backend.main import app

    return TestClient(app)


def test_rate_returns_rate(client):
    resp = client.get("/api/fx/rate", params={"base": "USD", "quote": "SGD"})
    assert resp.status_code == 200
    assert resp.json() == {"rate": 1.34, "date": "2026-07-01"}


def test_rate_maps_runtime_error_to_502(client, fake_fx):
    fake_fx.rate.side_effect = RuntimeError("boom")
    resp = client.get("/api/fx/rate", params={"base": "USD", "quote": "SGD"})
    assert resp.status_code == 502
