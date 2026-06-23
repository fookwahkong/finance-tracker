import base64
import json
from unittest.mock import MagicMock, patch

import pytest
import core.gmail as gmail_module


_FAKE_CREDS_JSON = json.dumps({
    "token": "x", "refresh_token": "y", "client_id": "z",
    "client_secret": "w", "token_uri": "https://oauth2.googleapis.com/token",
    "scopes": ["https://www.googleapis.com/auth/gmail.modify"],
})


def _encoded(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode()


def _full_message(msg_id: str, text: str) -> dict:
    return {
        "id": msg_id,
        "payload": {"body": {"data": _encoded(text)}, "parts": []},
    }


def _full_message_multipart(msg_id: str, text: str) -> dict:
    return {
        "id": msg_id,
        "payload": {
            "body": {},
            "parts": [
                {"mimeType": "text/plain", "body": {"data": _encoded(text)}},
                {"mimeType": "text/html", "body": {"data": _encoded("<p>html</p>")}},
            ],
        },
    }


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_returns_decoded_bodies(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    body_text = "Your DBS card was charged SGD 10.00 at STARBUCKS on 23 Jun 2026."
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg1"}]
    }
    svc.users.return_value.messages.return_value.get.return_value.execute.return_value = (
        _full_message("msg1", body_text)
    )

    result = gmail_module.fetch_unread("is:unread")

    assert len(result) == 1
    assert result[0]["id"] == "msg1"
    assert "SGD 10.00" in result[0]["body"]


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_handles_multipart_email(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    body_text = "SGD 5.00 at KOPITIAM on 23 Jun 2026."
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg2"}]
    }
    svc.users.return_value.messages.return_value.get.return_value.execute.return_value = (
        _full_message_multipart("msg2", body_text)
    )

    result = gmail_module.fetch_unread("is:unread")
    assert "SGD 5.00" in result[0]["body"]


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_returns_empty_when_no_messages(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    result = gmail_module.fetch_unread("is:unread")
    assert result == []


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_mark_read_calls_modify_with_correct_args(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    svc = MagicMock()
    mock_build.return_value = svc

    gmail_module.mark_read("msg1")

    svc.users.return_value.messages.return_value.modify.assert_called_once_with(
        userId="me", id="msg1", body={"removeLabelIds": ["UNREAD"]}
    )
