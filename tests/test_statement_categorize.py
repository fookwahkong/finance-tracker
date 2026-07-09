import core.parsing as parsing
import core.statement.categorize as categorize
from core.statement.categorize import categorize_rows


class _FakeProvider:
    def __init__(self, reply):
        self._reply = reply
        self.calls = 0

    def complete(self, system, user):
        self.calls += 1
        return self._reply


def test_maps_categories_and_marks_new(monkeypatch):
    reply = '{"categories": ["Food", "Transfers"]}'
    monkeypatch.setattr(parsing, "_provider", _FakeProvider(reply))
    out = categorize_rows(["OTTIE PANCAKES", "TOP-UP TO PAYLAH!"], ["Food"])
    assert out[0] == {"category": "Food", "is_new": False}
    assert out[1] == {"category": "Transfers", "is_new": True}


def test_dedupes_repeated_items(monkeypatch):
    fake = _FakeProvider('{"categories": ["Transfers"]}')
    monkeypatch.setattr(parsing, "_provider", fake)
    # Same merchant three times -> one unique lookup, but three results.
    out = categorize_rows(["TOP-UP TO PAYLAH!"] * 3, ["Food"])
    assert fake.calls == 1
    assert all(o == {"category": "Transfers", "is_new": True} for o in out)


def test_chunks_large_input(monkeypatch):
    # 30 unique items at chunk size 25 -> two provider calls.
    monkeypatch.setattr(categorize, "_CHUNK_SIZE", 25)
    fake = _FakeProvider('{"categories": []}')
    monkeypatch.setattr(parsing, "_provider", fake)
    items = [f"MERCHANT {i}" for i in range(30)]
    categorize_rows(items, ["Food"])
    assert fake.calls == 2


def test_bad_json_falls_back_to_none(monkeypatch):
    monkeypatch.setattr(parsing, "_provider", _FakeProvider("sorry, not json"))
    out = categorize_rows(["OTTIE PANCAKES"], ["Food"])
    assert out[0] == {"category": None, "is_new": False}


def test_empty_input_skips_model(monkeypatch):
    def _boom():
        raise AssertionError("provider should not be called for empty input")

    monkeypatch.setattr(parsing, "_get_provider", _boom)
    assert categorize_rows([], ["Food"]) == []
