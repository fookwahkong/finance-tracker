import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.execute.return_value.data = [
        {"name": "Food"}, {"name": "Transport"}
    ]
    svc.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": "abc", "item": "Grab", "category": "Transport",
        "amount": -12.5, "date": "2026-06-23", "source": "shortcut",
    }]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setenv("SHORTCUT_API_KEY", "test-shortcut-key")
    monkeypatch.setenv("CRON_SECRET", "test-cron-secret")
    monkeypatch.setenv("GMAIL_QUERY", "is:unread from:donotreply@dbs.com")
    monkeypatch.setattr("backend.routers.ingest.supabase", fake_supabase)
    from backend.main import app
    return TestClient(app)


# --- Shortcut endpoint ---

def test_shortcut_missing_api_key_returns_422(client):
    resp = client.post("/api/ingest/shortcut", json={"merchant": "Grab", "amount": 12.5})
    assert resp.status_code == 422


def test_shortcut_wrong_api_key_returns_401(client):
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "wrong"},
    )
    assert resp.status_code == 401


def test_shortcut_saves_parsed_transaction(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {"item": "Grab", "category": "Transport", "amount": -12.5, "date": "2026-06-23"},
    )
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "test-shortcut-key"},
    )
    assert resp.status_code == 201
    assert resp.json()["item"] == "Grab"
    # Verify source was set
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "shortcut"


def test_shortcut_falls_back_on_parse_failure(client, monkeypatch):
    def _fail(text, cats):
        raise ValueError("LLM error")
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", _fail)
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "test-shortcut-key"},
    )
    assert resp.status_code == 201


# --- Email endpoint ---

def test_email_wrong_cron_secret_returns_401(client):
    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401


def test_email_missing_auth_returns_422(client):
    resp = client.post("/api/ingest/email")
    assert resp.status_code == 422


def test_email_processes_one_message(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "SGD 10.00 at COFFEE on 23 Jun 2026"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {"merchant": "COFFEE", "amount": 10.0, "date": "2026-06-23"},
    )
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {"item": "Coffee", "category": "Food", "amount": -10.0, "date": "2026-06-23"},
    )
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "email"


def test_email_skips_unparseable_messages(client, monkeypatch):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "unrelated email content"}],
    )
    def _fail(body):
        raise ValueError("no match")
    monkeypatch.setattr("backend.routers.ingest.email_parser.parse", _fail)
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 0}


def test_email_returns_503_on_gmail_failure(client, monkeypatch):
    def _fail(q):
        raise Exception("Gmail API down")
    monkeypatch.setattr("backend.routers.ingest.gmail.fetch_unread", _fail)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 503


def test_email_falls_back_on_parse_transaction_failure(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "body"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {"merchant": "SHOP", "amount": 5.0, "date": "2026-06-23"},
    )
    def _fail(text, cats):
        raise ValueError("LLM error")
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", _fail)
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.post("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["category"] == "Uncategorized"
