import base64
import json

import pytest
from fastapi import HTTPException

from backend import deps


def _fake_jwt(sub: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"header.{payload}.sig"


def test_bearer_token_strips_prefix():
    assert deps.bearer_token("Bearer abc.def.ghi") == "abc.def.ghi"


def test_bearer_token_rejects_missing():
    with pytest.raises(HTTPException) as exc:
        deps.bearer_token("")
    assert exc.value.status_code == 401


def test_current_user_id_reads_sub():
    token = _fake_jwt("user-123")
    assert deps.current_user_id(token) == "user-123"
