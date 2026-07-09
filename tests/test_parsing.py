import pytest

import core.parsing as parsing
from core.parsing.extract import extract_json


def test_extract_plain_json():
    assert extract_json('{"item": "coffee", "amount": -4.5}') == {"item": "coffee", "amount": -4.5}


def test_extract_fenced_json():
    text = '```json\n{"item": "tea", "amount": -3}\n```'
    assert extract_json(text) == {"item": "tea", "amount": -3}


def test_extract_bare_fence():
    text = '```\n{"item": "tea", "amount": -3}\n```'
    assert extract_json(text) == {"item": "tea", "amount": -3}


def test_extract_garbage_raises():
    with pytest.raises(ValueError):
        extract_json("I could not parse that, sorry!")


class _FakeProvider:
    def __init__(self, reply):
        self._reply = reply

    def complete(self, system, user):
        return self._reply


def test_parse_transaction_uses_provider(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider('{"item": "lunch", "amount": -12.5}'))
    result = parsing.parse_transaction("lunch 12.50", ["Food"])
    assert result == {"item": "lunch", "amount": -12.5}


def test_parse_transaction_propagates_bad_json(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider("not json"))
    with pytest.raises(ValueError):
        parsing.parse_transaction("lunch", ["Food"])
