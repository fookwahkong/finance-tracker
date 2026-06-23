import base64
import json
import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


def _service():
    creds = Credentials.from_authorized_user_info(
        json.loads(os.environ["GMAIL_CREDENTIALS"]), _SCOPES
    )
    return build("gmail", "v1", credentials=creds)


def fetch_unread(query: str) -> list[dict]:
    svc = _service()
    result = svc.users().messages().list(userId="me", q=query).execute()
    messages = result.get("messages", [])
    out = []
    for msg in messages:
        full = svc.users().messages().get(userId="me", id=msg["id"], format="full").execute()
        out.append({"id": msg["id"], "body": _extract_body(full)})
    return out


def mark_read(message_id: str) -> None:
    svc = _service()
    svc.users().messages().modify(
        userId="me", id=message_id, body={"removeLabelIds": ["UNREAD"]}
    ).execute()


def _extract_body(message: dict) -> str:
    payload = message.get("payload", {})
    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain":
            data = part["body"].get("data", "")
            return base64.urlsafe_b64decode(data + "==").decode("utf-8")
    data = payload.get("body", {}).get("data", "")
    return base64.urlsafe_b64decode(data + "==").decode("utf-8")
