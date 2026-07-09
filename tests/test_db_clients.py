from unittest.mock import MagicMock

import core.db as db


def test_user_client_attaches_jwt(monkeypatch):
    made = {}

    def fake_create_client(url, key):
        client = MagicMock()
        made["key"] = key
        made["client"] = client
        return client

    monkeypatch.setattr(db, "create_client", fake_create_client)
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")

    c = db.user_client("jwt-token-123")

    assert made["key"] == "anon-key"
    made["client"].postgrest.auth.assert_called_once_with("jwt-token-123")
    assert c is made["client"]
