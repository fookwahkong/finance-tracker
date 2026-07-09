import base64
import binascii
import json
import os

from fastapi import Depends, Header, HTTPException
from supabase import Client

from core.db import user_client


def bearer_token(authorization: str = Header(default="")) -> str:
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len(prefix):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def get_db(token: str = Depends(bearer_token)) -> Client:
    return user_client(token)


def current_user_id(token: str = Depends(bearer_token)) -> str:
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)  # restore padding
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
        return claims["sub"]
    except (IndexError, KeyError, ValueError, binascii.Error):
        raise HTTPException(status_code=401, detail="Malformed token")


def enforce_ai_limit(
    user_id: str = Depends(current_user_id),
    db: Client = Depends(get_db),
) -> None:
    """Demo account: cap AI (LLM) calls at 5/day. Personal: unlimited."""
    if user_id != os.environ["DEMO_USER_ID"]:
        return
    count = db.rpc("increment_ai_usage").execute().data
    if count > 5:
        raise HTTPException(
            status_code=429,
            detail="Demo AI limit reached (5/day). Try again tomorrow.",
        )
