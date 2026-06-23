import base64
import html
import json
import os
import re
from typing import Optional

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


def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")


def _html_to_text(raw: str) -> str:
    raw = re.sub(r"<(style|script)\b[^>]*>.*?</\1>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    raw = re.sub(r"</(p|div|tr|td|table|h[1-6])>", "\n", raw, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


def _find_part(payload: dict, mime: str) -> Optional[str]:
    if payload.get("mimeType") == mime:
        data = payload.get("body", {}).get("data")
        if data:
            return data
    for part in payload.get("parts", []):
        found = _find_part(part, mime)
        if found:
            return found
    return None


def _extract_body(message: dict) -> str:
    # Prefer text/plain; DBS alerts are HTML-only, so fall back to converting
    # the text/html part to plain text. Both can be nested inside multipart parts.
    payload = message.get("payload", {})
    plain = _find_part(payload, "text/plain")
    if plain:
        return _decode(plain)
    html_data = _find_part(payload, "text/html")
    if html_data:
        return _html_to_text(_decode(html_data))
    data = payload.get("body", {}).get("data", "")
    return _decode(data) if data else ""
