from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.execute.return_value.data = [
        {"name": "Food"},
        {"name": "Transport"},
    ]
    svc.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "abc",
            "item": "Grab",
            "category": "Transport",
            "amount": -12.5,
            "date": "2026-06-23",
            "source": "shortcut",
        }
    ]
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
    # LLM returns a positive amount; Apple Pay is always a spend, so it must
    # be stored negative regardless.
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {
            "item": "Grab",
            "category": "Transport",
            "amount": 12.5,
            "date": "2026-06-23",
        },
    )
    resp = client.post(
        "/api/ingest/shortcut",
        json={"merchant": "Grab", "amount": 12.5},
        headers={"X-API-Key": "test-shortcut-key"},
    )
    assert resp.status_code == 201
    assert resp.json()["item"] == "Grab"
    # Apple Pay shortcut transactions are tagged as card payments, stored negative.
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "card"
    assert inserted["amount"] == -12.5


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
    resp = client.get("/api/ingest/email", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401


def test_email_missing_auth_returns_422(client):
    resp = client.get("/api/ingest/email")
    assert resp.status_code == 422


def test_email_processes_one_message(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [
            {
                "id": "m1",
                "body": "SGD 10.00 at COFFEE on 23 Jun 2026",
                "sender": "ibanking.alert@dbs.com",
            }
        ],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {
            "merchant": "COFFEE",
            "amount": 10.0,
            "date": "2026-06-23",
            "format": "transfer",
            "direction": "out",
        },
    )
    # LLM returns a positive amount; the email direction must override it.
    monkeypatch.setattr(
        "backend.routers.ingest.parse_transaction",
        lambda text, cats: {
            "item": "Coffee",
            "category": "Food",
            "amount": 10.0,
            "date": "2026-06-23",
        },
    )
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    # ibanking.alert + transfer format -> PayNow, and outgoing -> negative.
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "paynow"
    assert inserted["amount"] == -10.0


def test_email_received_is_positive_income(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "body", "sender": "ibanking.alert@dbs.com"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {
            "merchant": "CHUA WEN LI DANA",
            "amount": 116.15,
            "date": "2026-06-06",
            "format": "received",
            "direction": "in",
        },
    )
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", lambda text, cats: {})
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["amount"] == 116.15
    assert inserted["source"] == "paynow"


def test_email_paylah_sender_tagged_paylah(client, monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "body", "sender": "paylah.alert@dbs.com"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {
            "merchant": "FOMO PAY",
            "amount": 4.80,
            "date": "2026-06-22",
            "format": "transfer",
        },
    )
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", lambda text, cats: {})
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "paylah"


def test_email_giro_format_tagged_giro(client, monkeypatch, fake_supabase):
    # GIRO shares the ibanking.alert sender with PayNow, so the format decides.
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "body", "sender": "ibanking.alert@dbs.com"}],
    )
    monkeypatch.setattr(
        "backend.routers.ingest.email_parser.parse",
        lambda body: {
            "merchant": "SYFE PTE. LTD.",
            "amount": 133.73,
            "date": "2026-06-23",
            "format": "giro",
        },
    )
    monkeypatch.setattr("backend.routers.ingest.parse_transaction", lambda text, cats: {})
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["source"] == "giro"


def test_email_skips_unparseable_messages(client, monkeypatch):
    monkeypatch.setattr(
        "backend.routers.ingest.gmail.fetch_unread",
        lambda q: [{"id": "m1", "body": "unrelated email content"}],
    )

    def _fail(body):
        raise ValueError("no match")

    monkeypatch.setattr("backend.routers.ingest.email_parser.parse", _fail)
    monkeypatch.setattr("backend.routers.ingest.gmail.mark_read", lambda msg_id: None)

    resp = client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 0}


def test_email_returns_503_on_gmail_failure(client, monkeypatch):
    def _fail(q):
        raise Exception("Gmail API down")

    monkeypatch.setattr("backend.routers.ingest.gmail.fetch_unread", _fail)

    resp = client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
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

    resp = client.get("/api/ingest/email", headers={"Authorization": "Bearer test-cron-secret"})
    assert resp.status_code == 200
    assert resp.json() == {"processed": 1}
    inserted = fake_supabase.table.return_value.insert.call_args[0][0]
    assert inserted["category"] == "Uncategorized"


def test_insert_stamps_personal_user_id(monkeypatch):
    import backend.routers.ingest as ingest

    monkeypatch.setenv("PERSONAL_USER_ID", "personal-uuid")
    captured = {}

    class FakeTable:
        def insert(self, payload):
            captured["payload"] = payload
            return self

        def execute(self):
            class R:
                data = [{"id": "t1"}]
            return R()

    monkeypatch.setattr(ingest.supabase, "table", lambda name: FakeTable())

    ingest._insert("Lunch", "Food & Drink", -12.5, "2026-07-09", "card")

    assert captured["payload"]["user_id"] == "personal-uuid"
