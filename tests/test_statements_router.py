import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

import backend.routers.statements as statements


@pytest.fixture
def fake_supabase():
    svc = MagicMock()
    svc.table.return_value.select.return_value.execute.return_value.data = [
        {"name": "Food"}, {"name": "Transport"}
    ]
    svc.table.return_value.insert.return_value.execute.return_value.data = [{"id": "x"}]
    return svc


@pytest.fixture
def client(monkeypatch, fake_supabase):
    monkeypatch.setattr("backend.routers.statements.supabase", fake_supabase)
    from backend.main import app
    return TestClient(app)


# --- /parse ---

def test_parse_applies_sign_and_merges(client, monkeypatch):
    monkeypatch.setattr(statements, "extract_rows", lambda data: [
        {"date": "2026-05-02", "item": "OTTIE PANCAKES SINGAPORE",
         "amount": 2.40, "direction": "out", "source": "card"},
        {"date": "2026-05-01", "item": "KYM CONSTRUCTION",
         "amount": 350.00, "direction": "in", "source": "paynow"},
    ])
    monkeypatch.setattr(statements, "categorize_rows", lambda items, cats: [
        {"category": "Food", "is_new": False},
        {"category": "Income", "is_new": True},
    ])

    resp = client.post(
        "/api/statements/parse",
        files={"file": ("s.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert resp.status_code == 200
    rows = resp.json()["rows"]
    assert rows[0]["amount"] == -2.40                  # 'out' -> negative
    assert rows[0]["item"] == "OTTIE PANCAKES SINGAPORE"  # merchant from extract
    assert rows[0]["source"] == "card"
    assert rows[0]["suggested_category"] == "Food"
    assert rows[1]["amount"] == 350.00                 # 'in' -> positive
    assert rows[1]["is_new"] is True


def test_parse_paylah_forces_food_and_drink(client, monkeypatch):
    monkeypatch.setattr(statements, "extract_rows", lambda data: [
        {"date": "2026-05-02", "item": "FOMO PAY", "amount": 4.80,
         "direction": "out", "source": "paylah"},
    ])
    # LLM suggests something else; the PayLah rule must override it.
    monkeypatch.setattr(statements, "categorize_rows", lambda items, cats: [
        {"category": "Shopping", "is_new": False},
    ])
    resp = client.post(
        "/api/statements/parse",
        files={"file": ("s.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert resp.status_code == 200
    row = resp.json()["rows"][0]
    assert row["suggested_category"] == "Food & Drink"
    assert row["is_new"] is False


def test_parse_rejects_empty(client, monkeypatch):
    monkeypatch.setattr(statements, "extract_rows", lambda data: [])
    monkeypatch.setattr(statements, "categorize_rows", lambda descs, cats: [])
    resp = client.post(
        "/api/statements/parse",
        files={"file": ("s.pdf", b"x", "application/pdf")},
    )
    assert resp.status_code == 422


def test_parse_scanned_pdf_message(client, monkeypatch):
    def _scanned(data):
        raise ValueError("This looks like a scanned PDF; only digital statements are supported.")
    monkeypatch.setattr(statements, "extract_rows", _scanned)
    resp = client.post(
        "/api/statements/parse",
        files={"file": ("s.pdf", b"x", "application/pdf")},
    )
    assert resp.status_code == 422
    assert "scanned" in resp.json()["detail"]


# --- /import ---

def test_import_inserts_rows_and_creates_new_category(client, fake_supabase):
    payload = {"rows": [
        {"date": "2026-05-02", "item": "Ottie Pancakes", "amount": -2.40,
         "source": "card", "category": "Food"},
        {"date": "2026-05-01", "item": "Salary", "amount": 350.00,
         "source": "paynow", "category": "Income"},   # not in known -> created
    ]}
    resp = client.post("/api/statements/import", json=payload)
    assert resp.status_code == 200
    assert resp.json() == {"inserted": 2}

    inserts = [c.args[0] for c in fake_supabase.table.return_value.insert.call_args_list]
    assert {"name": "Income"} in inserts          # new category created
    items = [i.get("item") for i in inserts if "item" in i]
    assert "Ottie Pancakes" in items and "Salary" in items
