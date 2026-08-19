from unittest.mock import MagicMock

from fastapi.testclient import TestClient

JAPAN = {
    "id": "g1",
    "name": "Japan",
    "destination": "Tokyo",
    "start_date": "2026-08-18",
    "end_date": "2026-08-26",
}


def _client(db):
    from backend.deps import get_db
    from backend.main import app

    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app), app


def _select_chain(db, order_data=None, eq_data=None, in_data=None):
    """Wire the supabase-py builder chains the travel router uses."""
    table = db.table.return_value
    select = table.select.return_value
    select.order.return_value.execute.return_value.data = (
        order_data if order_data is not None else []
    )
    select.eq.return_value.execute.return_value.data = eq_data if eq_data is not None else []
    select.in_.return_value.execute.return_value.data = in_data if in_data is not None else []
    return table


def test_list_groups_returns_empty_list_when_there_are_none():
    db = MagicMock()
    _select_chain(db)
    client, app = _client(db)
    try:
        response = client.get("/api/travel/groups")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []


def test_list_groups_attaches_overrides_to_their_group():
    db = MagicMock()
    _select_chain(
        db,
        order_data=[JAPAN],
        in_data=[
            {"id": "o1", "group_id": "g1", "transaction_id": "t9", "mode": "include"},
            {"id": "o2", "group_id": "other", "transaction_id": "t8", "mode": "exclude"},
        ],
    )
    client, app = _client(db)
    try:
        response = client.get("/api/travel/groups")
    finally:
        app.dependency_overrides.clear()

    body = response.json()
    assert len(body) == 1
    assert [o["id"] for o in body[0]["overrides"]] == ["o1"]


def test_create_group_persists_a_validated_payload():
    db = MagicMock()
    table = _select_chain(db)
    table.insert.return_value.execute.return_value.data = [JAPAN]
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups",
            json={
                "name": "  Japan  ",
                "destination": "Tokyo",
                "start_date": "2026-08-18",
                "end_date": "2026-08-26",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["overrides"] == []
    # The name reaches the database trimmed.
    assert db.table.return_value.insert.call_args[0][0]["name"] == "Japan"


def test_create_group_rejects_an_inverted_range():
    db = MagicMock()
    _select_chain(db)
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups",
            json={"name": "Japan", "start_date": "2026-08-26", "end_date": "2026-08-18"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert "end date" in response.json()["detail"].lower()


def test_create_group_rejects_a_blank_name():
    db = MagicMock()
    _select_chain(db)
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups",
            json={"name": "   ", "start_date": "2026-08-18", "end_date": "2026-08-26"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_create_group_rejects_dates_overlapping_an_existing_trip():
    db = MagicMock()
    _select_chain(db, order_data=[JAPAN])
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups",
            json={"name": "Osaka", "start_date": "2026-08-24", "end_date": "2026-09-02"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Japan" in detail  # the clashing trip is named, not just "conflict"
    assert db.table.return_value.insert.called is False


def test_update_group_can_redate_onto_its_own_dates():
    db = MagicMock()
    table = _select_chain(db, order_data=[JAPAN], eq_data=[JAPAN])
    moved = {**JAPAN, "end_date": "2026-08-28"}
    table.update.return_value.eq.return_value.execute.return_value.data = [moved]
    client, app = _client(db)
    try:
        response = client.put("/api/travel/groups/g1", json={"end_date": "2026-08-28"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["end_date"] == "2026-08-28"


def test_update_group_rejects_dates_overlapping_a_different_trip():
    db = MagicMock()
    bali = {"id": "g2", "name": "Bali", "start_date": "2026-10-01", "end_date": "2026-10-07"}
    _select_chain(db, order_data=[JAPAN, bali], eq_data=[JAPAN])
    client, app = _client(db)
    try:
        response = client.put(
            "/api/travel/groups/g1",
            json={"start_date": "2026-10-05", "end_date": "2026-10-09"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert "Bali" in response.json()["detail"]


def test_update_group_404s_for_an_unknown_id():
    db = MagicMock()
    _select_chain(db)
    client, app = _client(db)
    try:
        response = client.put("/api/travel/groups/nope", json={"name": "Japan"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_delete_group_removes_the_group_and_no_transactions():
    db = MagicMock()
    table = _select_chain(db)
    table.delete.return_value.eq.return_value.execute.return_value.data = [JAPAN]
    client, app = _client(db)
    try:
        response = client.delete("/api/travel/groups/g1")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
    # Only travel_groups is deleted from; the ledger is never touched.
    assert [c.args[0] for c in db.table.call_args_list] == ["travel_groups"]


def test_delete_group_404s_for_an_unknown_id():
    db = MagicMock()
    table = _select_chain(db)
    table.delete.return_value.eq.return_value.execute.return_value.data = []
    client, app = _client(db)
    try:
        response = client.delete("/api/travel/groups/nope")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_upsert_override_includes_a_pre_trip_booking():
    db = MagicMock()
    table = _select_chain(db, eq_data=[JAPAN])
    saved = {"id": "o1", "group_id": "g1", "transaction_id": "t9", "mode": "include"}
    table.upsert.return_value.execute.return_value.data = [saved]
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups/g1/transactions",
            json={"transaction_id": "t9", "mode": "include"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["mode"] == "include"


def test_upsert_override_rejects_an_unknown_mode():
    db = MagicMock()
    _select_chain(db, eq_data=[JAPAN])
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups/g1/transactions",
            json={"transaction_id": "t9", "mode": "maybe"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_upsert_override_404s_when_the_trip_is_gone():
    db = MagicMock()
    _select_chain(db)
    client, app = _client(db)
    try:
        response = client.post(
            "/api/travel/groups/nope/transactions",
            json={"transaction_id": "t9", "mode": "include"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_clear_override_returns_the_transaction_to_date_derivation():
    db = MagicMock()
    table = _select_chain(db)
    table.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"id": "o1"}
    ]
    client, app = _client(db)
    try:
        response = client.delete("/api/travel/groups/g1/transactions/t9")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204


def test_clear_override_404s_when_there_was_none():
    db = MagicMock()
    table = _select_chain(db)
    table.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    client, app = _client(db)
    try:
        response = client.delete("/api/travel/groups/g1/transactions/t9")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
