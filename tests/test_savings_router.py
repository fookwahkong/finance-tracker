from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def test_list_savings_returns_empty_workspace():
    from backend.deps import get_db
    from backend.main import app

    db = MagicMock()
    db.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.order.return_value.execute.return_value.data = []
    app.dependency_overrides[get_db] = lambda: db

    try:
        response = TestClient(app).get("/api/savings")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "profile": None,
        "goals": [],
        "contributions": [],
    }
