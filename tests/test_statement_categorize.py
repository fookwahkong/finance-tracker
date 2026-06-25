import core.parsing as parsing
from core.statement.categorize import categorize_rows


class _FakeProvider:
    def __init__(self, reply):
        self._reply = reply

    def complete(self, system, user):
        return self._reply


def test_maps_items_and_marks_new_category(monkeypatch):
    reply = (
        '{"rows": ['
        '{"item": "Ottie Pancakes", "category": "Food"},'
        '{"item": "PayLah Top-up", "category": "Transfers"}'
        ']}'
    )
    monkeypatch.setattr(parsing, "_provider", _FakeProvider(reply))
    out = categorize_rows(
        ["Debit Card transaction\nOTTIE PANCAKES", "Funds Transfer\nTOP-UP TO PAYLAH! :"],
        ["Food"],
    )
    assert out[0] == {"item": "Ottie Pancakes", "category": "Food", "is_new": False}
    assert out[1] == {"item": "PayLah Top-up", "category": "Transfers", "is_new": True}


def test_bad_json_falls_back_per_row(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider("sorry, not json"))
    out = categorize_rows(["Debit Card transaction\nOTTIE PANCAKES"], ["Food"])
    assert out[0]["category"] is None
    assert out[0]["is_new"] is False
    assert out[0]["item"] == "Debit Card transaction"


def test_empty_input_skips_model(monkeypatch):
    def _boom():
        raise AssertionError("provider should not be called for empty input")
    monkeypatch.setattr(parsing, "_get_provider", _boom)
    assert categorize_rows([], ["Food"]) == []
