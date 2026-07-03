"""frankfurter.dev FX client (free, no API key).

Returns {"rate": float, "date": str} for USD->SGD, cached 24h — the rate only
feeds the net-worth asset line, so daily freshness is plenty.
"""
import httpx

from core.investments import cache

BASE_URL = "https://api.frankfurter.dev/v1"


class FxClient:
    def __init__(self):
        self._http = httpx.Client(base_url=BASE_URL)

    def usd_sgd(self) -> dict:
        def fetch():
            try:
                resp = self._http.get("/latest", params={"from": "USD", "to": "SGD"}, timeout=15)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                raise RuntimeError(f"FX request failed: {exc}") from exc
            data = resp.json()
            if not isinstance(data, dict) or "rates" not in data or "SGD" not in data["rates"]:
                raise RuntimeError(f"FX returned an unexpected payload: {data}")
            return {"rate": data["rates"]["SGD"], "date": data.get("date")}

        return cache.get_or_fetch("fx:USD:SGD", fetch, 86400)
