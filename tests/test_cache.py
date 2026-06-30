from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from core.investments import cache


class FakeTable:
    def __init__(self, store):
        self.store = store
        self._key = None
        self._upsert = None

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._key = val
        return self

    def maybe_single(self):
        return self

    def upsert(self, row):
        self._upsert = row
        return self

    def execute(self):
        if self._upsert is not None:
            self.store[self._upsert["key"]] = {
                "data": self._upsert["data"],
                "fetched_at": self._upsert["fetched_at"],
            }
            return SimpleNamespace(data=self._upsert)
        return SimpleNamespace(data=self.store.get(self._key))


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return FakeTable(self.store)


@pytest.fixture
def store(monkeypatch):
    s = {}
    monkeypatch.setattr(cache, "supabase", FakeSupabase(s))
    return s


def test_miss_fetches_and_caches(store):
    calls = []

    def fetch():
        calls.append(1)
        return {"ok": True}

    result = cache.get_or_fetch("AAPL:ticker", fetch, 3600)
    assert result == {"ok": True}
    assert calls == [1]
    assert store["AAPL:ticker"]["data"] == {"ok": True}


def test_hit_within_ttl_skips_fetch(store):
    store["AAPL:ticker"] = {
        "data": {"cached": True},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    def fetch():
        raise AssertionError("should not fetch on a fresh hit")

    result = cache.get_or_fetch("AAPL:ticker", fetch, 3600)
    assert result == {"cached": True}


def test_stale_entry_refetches(store):
    old = datetime.now(timezone.utc) - timedelta(seconds=7200)
    store["AAPL:ticker"] = {"data": {"stale": True}, "fetched_at": old.isoformat()}

    result = cache.get_or_fetch("AAPL:ticker", lambda: {"fresh": True}, 3600)
    assert result == {"fresh": True}
    assert store["AAPL:ticker"]["data"] == {"fresh": True}


def test_caches_list_payload(store):
    result = cache.get_or_fetch("AAPL:income", lambda: [{"y": 2025}], 604800)
    assert result == [{"y": 2025}]
    assert store["AAPL:income"]["data"] == [{"y": 2025}]


class NoneOnMissTable(FakeTable):
    # Mirrors the real postgrest client: maybe_single().execute() returns None
    # (not a response object) when no row matches.
    def execute(self):
        if self._upsert is None and self._key not in self.store:
            return None
        return super().execute()


class NoneOnMissSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return NoneOnMissTable(self.store)


def test_miss_returning_none_response_is_treated_as_miss(monkeypatch):
    s = {}
    monkeypatch.setattr(cache, "supabase", NoneOnMissSupabase(s))

    result = cache.get_or_fetch("AAPL:ticker", lambda: {"ok": True}, 3600)
    assert result == {"ok": True}
    assert s["AAPL:ticker"]["data"] == {"ok": True}
