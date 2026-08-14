"""frankfurter.dev FX client (free, no API key), server-cached 24h.

Generic over currency pair — used for the net-worth USD asset line and for
converting foreign-currency transactions (e.g. CNY) to their SGD equivalent.
"""

import httpx

from core.investments import cache

BASE_URL = "https://api.frankfurter.dev/v1"


class FxClient:
    def __init__(self):
        self._http = httpx.Client(base_url=BASE_URL)

    def rate(self, base: str, quote: str) -> dict:
        def fetch():
            try:
                resp = self._http.get("/latest", params={"from": base, "to": quote}, timeout=15)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                raise RuntimeError(f"FX request failed: {exc}") from exc
            data = resp.json()
            if not isinstance(data, dict) or "rates" not in data or quote not in data["rates"]:
                raise RuntimeError(f"FX returned an unexpected payload: {data}")
            return {"rate": data["rates"][quote], "date": data.get("date")}

        return cache.get_or_fetch(f"fx:{base}:{quote}", fetch, 86400)
