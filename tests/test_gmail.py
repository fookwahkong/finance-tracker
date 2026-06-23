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


def _full_message_html_only(msg_id: str, html: str) -> dict:
    # DBS PayLah!/PayNow alerts arrive as multipart/mixed with ONLY a text/html
    # part (no text/plain), wrapping the transaction details in markup.
    return {
        "id": msg_id,
        "payload": {
            "mimeType": "multipart/mixed",
            "body": {},
            "parts": [
                {"mimeType": "text/html", "body": {"data": _encoded(html)}},
            ],
        },
    }


@patch("core.gmail.build")
@patch("core.gmail.Credentials.from_authorized_user_info")
def test_fetch_unread_extracts_html_only_email(mock_creds, mock_build, monkeypatch):
    monkeypatch.setenv("GMAIL_CREDENTIALS", _FAKE_CREDS_JSON)
    html = (
        "<html><head><style>.x{color:#fff}</style></head><body>"
        "<table><tr><td>Date &amp; Time:</td><td>23 Jun 09:15 (SGT)</td></tr>"
        "<tr><td>Amount:</td><td>SGD4.30</td></tr>"
        "<tr><td>To:</td><td>ECON FOOD DELIGHTS</td></tr></table>"
        "</body></html>"
    )
    svc = MagicMock()
    mock_build.return_value = svc
    svc.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg3"}]
    }
    svc.users.return_value.messages.return_value.get.return_value.execute.return_value = (
        _full_message_html_only("msg3", html)
    )

    body = gmail_module.fetch_unread("is:unread")[0]["body"]

    # Tags stripped, CSS dropped, and &amp; decoded so the parser's labels match.
    assert "Date & Time:" in body
    assert "SGD4.30" in body
    assert "ECON FOOD DELIGHTS" in body
    assert ".x{color" not in body
    assert "<td>" not in body


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
