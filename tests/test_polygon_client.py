from core.investments import cache


def test_get_or_fetch_calls_fetch_and_returns_result():
    calls = []

    def fetch():
        calls.append(1)
        return {"ok": True}

    result = cache.get_or_fetch("AAPL:ticker", fetch)
    assert result == {"ok": True}
    assert calls == [1]
