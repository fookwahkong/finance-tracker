from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_root_health():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_api_routes_are_mounted():
    paths = {route.path for route in app.routes}
    assert "/api/transactions" in paths
    assert "/api/categories" in paths
    assert "/api/reports/monthly" in paths
    assert "/api/webhook" in paths
    assert "/api/ingest/email" in paths


def test_vercel_handler_imports():
    import api.index

    assert api.index.handler is not None


def test_transaction_update_accepts_date_string():
    from core.models import TransactionUpdate

    tx = TransactionUpdate.model_validate({"date": "2026-06-24"})
    assert tx.date.isoformat() == "2026-06-24"
