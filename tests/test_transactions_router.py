from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.deps import get_db
from backend.main import app

CATEGORIES = [{"name": "Food & Drink"}, {"name": "Others"}]


class FakeTable:
    def __init__(self, name, inserted):
        self.name = name
        self.inserted = inserted
        self._payload = None

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def insert(self, payload):
        self._payload = payload
        return self

    def execute(self):
        if self.name == "categories":
            return SimpleNamespace(data=CATEGORIES)
        if self._payload is not None:
            self.inserted.append(self._payload)
            return SimpleNamespace(data=[{"id": "tx-1", **self._payload}])
        return SimpleNamespace(data=[])


class FakeDB:
    def __init__(self):
        self.inserted = []

    def table(self, name):
        return FakeTable(name, self.inserted)


@pytest.fixture
def db():
    fake = FakeDB()
    app.dependency_overrides[get_db] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client(db):
    return TestClient(app, raise_server_exceptions=False)


def post(client, **fields):
    body = {"date": "2026-09-05", "item": "lunch", **fields}
    return client.post("/api/transactions", json=body, headers={"Authorization": "Bearer t"})


def test_create_sgd_transaction(client, db):
    resp = post(client, currency="SGD", amount=-12.5, category="Food & Drink")

    assert resp.status_code == 201
    assert resp.json()["amount"] == -12.5
    # SGD amounts are already canonical, so nothing foreign is recorded.
    assert db.inserted[0]["foreign_amount"] is None


def test_create_sgd_transaction_does_not_touch_fx(client, monkeypatch):
    def boom(*a, **k):
        raise AssertionError("SGD must not need an exchange rate")

    monkeypatch.setattr("core.validation.FxClient", boom)

    assert post(client, currency="SGD", amount=-12.5).status_code == 201


def test_create_cny_transaction_converts_to_sgd(client, db, monkeypatch):
    monkeypatch.setattr(
        "core.validation.FxClient",
        lambda: SimpleNamespace(rate=lambda *a: {"rate": 0.19, "date": "2026-09-05"}),
    )

    resp = post(client, currency="CNY", foreign_amount=-30)

    assert resp.status_code == 201
    body = resp.json()
    # amount stays the canonical SGD value every other reader depends on.
    assert body["amount"] == round(-30 * 0.19, 2)
    assert body["foreign_amount"] == -30


def test_create_cny_returns_502_naming_fx_when_the_rate_provider_is_down(client, monkeypatch):
    def down(*a):
        raise RuntimeError("FX request failed: timeout")

    monkeypatch.setattr("core.validation.FxClient", lambda: SimpleNamespace(rate=down))

    resp = post(client, currency="CNY", foreign_amount=-30)

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    # The message has to name the exchange rate as the failing half — this is
    # the case that otherwise reads as "the database is down".
    assert "exchange-rate provider" in detail
    assert "CNY" in detail


def test_invalid_amount_is_a_422_with_the_reason(client):
    resp = post(client, currency="SGD", amount=0)

    assert resp.status_code == 422
    assert resp.json()["detail"] == "Amount cannot be zero."


def test_unknown_category_falls_back_to_others(client):
    resp = post(client, currency="SGD", amount=-5, category="Nonsense")

    assert resp.status_code == 201
    assert resp.json()["category"] == "Others"
