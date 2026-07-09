from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def fake_supabase():
    return MagicMock()


@pytest.fixture
def client(fake_supabase):
    from backend.deps import get_db
    from backend.main import app

    app.dependency_overrides[get_db] = lambda: fake_supabase
    yield TestClient(app)
    app.dependency_overrides.clear()


def _tx(amount, tx_id="d1", category="Groceries"):
    return {
        "id": tx_id,
        "amount": amount,
        "category": category,
        "date": "2026-06-01",
        "item": "Dinner",
    }


def _set_table_router(fake_supabase, handlers):
    fake_supabase.table.side_effect = lambda name: handlers[name]


def test_create_claim_from_debit(client, fake_supabase):
    tx_tbl, claims_tbl = MagicMock(), MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(-100)]
    claims_tbl.select.return_value.eq.return_value.execute.return_value.data = []
    claims_tbl.insert.return_value.execute.return_value.data = [
        {
            "id": "c1",
            "debit_tx_id": "d1",
            "total": 100,
            "my_share": 25,
            "expected": 75,
            "category": "Groceries",
            "status": "open",
        }
    ]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claims": claims_tbl})

    resp = client.post(
        "/api/claims", json={"debit_tx_id": "d1", "my_share": 25, "counterparty": "Friend"}
    )

    assert resp.status_code == 201
    assert resp.json()["expected"] == 75
    sent = claims_tbl.insert.call_args[0][0]
    assert sent["total"] == 100
    assert sent["expected"] == 75
    assert sent["category"] == "Groceries"
    assert sent["counterparty"] == "Friend"


def test_create_claim_rejects_positive_tx(client, fake_supabase):
    tx_tbl = MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(50)]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claims": MagicMock()})

    resp = client.post("/api/claims", json={"debit_tx_id": "d1", "my_share": 10})

    assert resp.status_code == 422


def test_create_claim_rejects_share_ge_total(client, fake_supabase):
    tx_tbl, claims_tbl = MagicMock(), MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(-100)]
    claims_tbl.select.return_value.eq.return_value.execute.return_value.data = []
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claims": claims_tbl})

    resp = client.post("/api/claims", json={"debit_tx_id": "d1", "my_share": 100})

    assert resp.status_code == 422


def test_create_claim_rejects_unknown_debit(client, fake_supabase):
    tx_tbl = MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = []
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claims": MagicMock()})

    resp = client.post("/api/claims", json={"debit_tx_id": "missing", "my_share": 10})

    assert resp.status_code == 422


def test_create_claim_rejects_duplicate(client, fake_supabase):
    tx_tbl, claims_tbl = MagicMock(), MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(-100)]
    claims_tbl.select.return_value.eq.return_value.execute.return_value.data = [{"id": "c0"}]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claims": claims_tbl})

    resp = client.post("/api/claims", json={"debit_tx_id": "d1", "my_share": 25})

    assert resp.status_code == 422


def test_list_open_claims_enriched(client, fake_supabase):
    claims_tbl, links_tbl = MagicMock(), MagicMock()
    claims_tbl.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "c1", "expected": 75, "status": "open", "category": "Groceries"},
    ]
    links_tbl.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "l1", "claim_id": "c1", "allocated_amount": 50},
    ]
    _set_table_router(fake_supabase, {"claims": claims_tbl, "claim_credits": links_tbl})

    resp = client.get("/api/claims?status=open")

    assert resp.status_code == 200
    row = resp.json()[0]
    assert row["received"] == 50
    assert row["remaining"] == 25
    assert row["links"] == [{"id": "l1", "claim_id": "c1", "allocated_amount": 50}]


def test_link_credit(client, fake_supabase):
    tx_tbl, links_tbl = MagicMock(), MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(80, "cr1")]
    links_tbl.select.return_value.eq.return_value.execute.return_value.data = []
    links_tbl.insert.return_value.execute.return_value.data = [
        {"id": "l1", "claim_id": "c1", "credit_tx_id": "cr1", "allocated_amount": 80},
    ]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claim_credits": links_tbl})

    resp = client.post(
        "/api/claims/c1/credits", json={"credit_tx_id": "cr1", "allocated_amount": 80}
    )

    assert resp.status_code == 201
    assert resp.json()["allocated_amount"] == 80


def test_link_rejects_negative_tx(client, fake_supabase):
    tx_tbl = MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(-5, "cr1")]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claim_credits": MagicMock()})

    resp = client.post(
        "/api/claims/c1/credits", json={"credit_tx_id": "cr1", "allocated_amount": 5}
    )

    assert resp.status_code == 422


def test_link_rejects_unknown_credit(client, fake_supabase):
    tx_tbl = MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = []
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claim_credits": MagicMock()})

    resp = client.post(
        "/api/claims/c1/credits", json={"credit_tx_id": "missing", "allocated_amount": 5}
    )

    assert resp.status_code == 422


def test_link_rejects_over_allocation(client, fake_supabase):
    tx_tbl, links_tbl = MagicMock(), MagicMock()
    tx_tbl.select.return_value.eq.return_value.execute.return_value.data = [_tx(80, "cr1")]
    links_tbl.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "l0", "credit_tx_id": "cr1", "allocated_amount": 30},
    ]
    _set_table_router(fake_supabase, {"transactions": tx_tbl, "claim_credits": links_tbl})

    resp = client.post(
        "/api/claims/c1/credits", json={"credit_tx_id": "cr1", "allocated_amount": 60}
    )

    assert resp.status_code == 422


def test_unlink_credit(client, fake_supabase):
    links_tbl = MagicMock()
    links_tbl.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"id": "l1"}
    ]
    _set_table_router(fake_supabase, {"claim_credits": links_tbl})

    resp = client.delete("/api/claims/c1/credits/l1")

    assert resp.status_code == 204


def test_settle_and_reopen(client, fake_supabase):
    claims_tbl = MagicMock()
    claims_tbl.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": "c1", "status": "settled"}
    ]
    _set_table_router(fake_supabase, {"claims": claims_tbl})

    settle = client.post("/api/claims/c1/settle")
    reopen = client.post("/api/claims/c1/reopen")

    assert settle.status_code == 200
    assert reopen.status_code == 200
    assert claims_tbl.update.call_args_list[0][0][0]["status"] == "settled"
    assert claims_tbl.update.call_args_list[1][0][0] == {"status": "open", "settled_at": None}


def test_delete_claim(client, fake_supabase):
    claims_tbl = MagicMock()
    claims_tbl.delete.return_value.eq.return_value.execute.return_value.data = [{"id": "c1"}]
    _set_table_router(fake_supabase, {"claims": claims_tbl})

    resp = client.delete("/api/claims/c1")

    assert resp.status_code == 204
