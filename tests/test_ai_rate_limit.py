from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from backend import deps


def _db_returning(count):
    db = MagicMock()
    db.rpc.return_value.execute.return_value.data = count
    return db


def test_personal_user_is_not_limited(monkeypatch):
    monkeypatch.setenv("DEMO_USER_ID", "demo-id")
    db = _db_returning(999)
    # Should not raise, should not increment.
    deps.enforce_ai_limit(user_id="personal-id", db=db)
    db.rpc.assert_not_called()


def test_demo_under_limit_passes(monkeypatch):
    monkeypatch.setenv("DEMO_USER_ID", "demo-id")
    db = _db_returning(5)  # 5th call
    deps.enforce_ai_limit(user_id="demo-id", db=db)
    db.rpc.assert_called_once_with("increment_ai_usage")


def test_demo_over_limit_raises_429(monkeypatch):
    monkeypatch.setenv("DEMO_USER_ID", "demo-id")
    db = _db_returning(6)  # 6th call
    with pytest.raises(HTTPException) as exc:
        deps.enforce_ai_limit(user_id="demo-id", db=db)
    assert exc.value.status_code == 429
