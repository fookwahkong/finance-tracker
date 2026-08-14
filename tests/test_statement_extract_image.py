import json

import pytest

import core.parsing as parsing
import core.statement.extract_image as extract_image
from core.statement.extract_image import extract_rows_from_image
from tests.fixtures.blank_pdf import BLANK_PDF_BYTES


class _FakeVisionProvider:
    def __init__(self, reply=None, exc=None):
        self._reply = reply
        self._exc = exc
        self.calls = []

    def complete_vision(self, system, user, images):
        if self._exc:
            raise self._exc
        self.calls.append((system, user, images))
        return self._reply


def _use_fake_render(monkeypatch, images=(b"fake-png",)):
    monkeypatch.setattr(extract_image, "_render_pages", lambda pdf_bytes: list(images))


def test_returns_validated_rows(monkeypatch):
    _use_fake_render(monkeypatch)
    reply = json.dumps(
        {
            "rows": [
                {
                    "date": "2026-08-14",
                    "item": "TikTok Shop Seller",
                    "amount": 3.6,
                    "direction": "out",
                    "source": "card",
                },
                {
                    "date": "2026-08-13",
                    "item": "K5 ENGINEERING WORK",
                    "amount": 1000.0,
                    "direction": "in",
                    "source": "paynow",
                },
            ]
        }
    )
    fake = _FakeVisionProvider(reply=reply)
    monkeypatch.setattr(parsing, "_provider", fake)

    rows = extract_rows_from_image(b"pdf-bytes")

    assert rows == [
        {
            "date": "2026-08-14",
            "item": "TikTok Shop Seller",
            "amount": 3.6,
            "direction": "out",
            "source": "card",
        },
        {
            "date": "2026-08-13",
            "item": "K5 ENGINEERING WORK",
            "amount": 1000.0,
            "direction": "in",
            "source": "paynow",
        },
    ]
    assert len(fake.calls) == 1


def test_unknown_source_defaults_to_none(monkeypatch):
    _use_fake_render(monkeypatch)
    reply = json.dumps(
        {
            "rows": [
                {
                    "date": "2026-08-14",
                    "item": "Interest Earned",
                    "amount": 1.01,
                    "direction": "in",
                    "source": "something-unexpected",
                }
            ]
        }
    )
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply=reply))

    rows = extract_rows_from_image(b"pdf-bytes")

    assert rows[0]["source"] is None


def test_missing_rows_key_returns_empty(monkeypatch):
    _use_fake_render(monkeypatch)
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply="{}"))

    assert extract_rows_from_image(b"pdf-bytes") == []


def test_bad_json_raises(monkeypatch):
    _use_fake_render(monkeypatch)
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply="not json"))

    with pytest.raises(ValueError):
        extract_rows_from_image(b"pdf-bytes")


def test_invalid_direction_raises(monkeypatch):
    _use_fake_render(monkeypatch)
    reply = json.dumps(
        {"rows": [{"date": "2026-08-14", "item": "X", "amount": 1.0, "direction": "sideways"}]}
    )
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply=reply))

    with pytest.raises(ValueError):
        extract_rows_from_image(b"pdf-bytes")


def test_non_positive_amount_raises(monkeypatch):
    _use_fake_render(monkeypatch)
    reply = json.dumps(
        {"rows": [{"date": "2026-08-14", "item": "X", "amount": 0, "direction": "out"}]}
    )
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply=reply))

    with pytest.raises(ValueError):
        extract_rows_from_image(b"pdf-bytes")


def test_bad_date_raises(monkeypatch):
    _use_fake_render(monkeypatch)
    reply = json.dumps(
        {"rows": [{"date": "14 Aug 2026", "item": "X", "amount": 1.0, "direction": "out"}]}
    )
    monkeypatch.setattr(parsing, "_provider", _FakeVisionProvider(reply=reply))

    with pytest.raises(ValueError):
        extract_rows_from_image(b"pdf-bytes")


def test_ollama_not_implemented_becomes_value_error(monkeypatch):
    _use_fake_render(monkeypatch)
    fake = _FakeVisionProvider(exc=NotImplementedError("no vision on ollama"))
    monkeypatch.setattr(parsing, "_provider", fake)

    with pytest.raises(ValueError, match="LLM_PROVIDER=claude"):
        extract_rows_from_image(b"pdf-bytes")


def test_render_pages_produces_one_png_per_page():
    images = extract_image._render_pages(BLANK_PDF_BYTES)

    assert len(images) == 1
    assert images[0].startswith(b"\x89PNG")
