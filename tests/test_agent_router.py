from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from backend.deps import enforce_ai_limit, get_db
    from backend.main import app

    app.dependency_overrides[enforce_ai_limit] = lambda: None
    app.dependency_overrides[get_db] = lambda: MagicMock()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_chat_returns_reply_and_history(client, monkeypatch):
    fake = MagicMock(return_value={"reply": "You spent $200.", "history": [{"role": "user", "content": "hi"}]})
    monkeypatch.setattr("backend.routers.agent.run_agent_turn", fake)

    resp = client.post("/api/agent/chat", json={"message": "How much did I spend?", "history": []})

    assert resp.status_code == 200
    assert resp.json() == {"reply": "You spent $200.", "history": [{"role": "user", "content": "hi"}]}
    fake.assert_called_once()
    args = fake.call_args
    assert args.kwargs["message"] == "How much did I spend?"
    assert args.kwargs["history"] == []


def test_chat_defaults_history_to_empty_list(client, monkeypatch):
    fake = MagicMock(return_value={"reply": "ok", "history": []})
    monkeypatch.setattr("backend.routers.agent.run_agent_turn", fake)

    resp = client.post("/api/agent/chat", json={"message": "hi"})

    assert resp.status_code == 200
    assert fake.call_args.kwargs["history"] == []


def test_chat_requires_message(client):
    resp = client.post("/api/agent/chat", json={})
    assert resp.status_code == 422
