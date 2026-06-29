"""Polygon.io REST client.

Returns raw parsed JSON exactly as Polygon sends it (feature 1 displays all
fields untouched). Follows the httpx error pattern in core/parsing/ollama.py.
"""
import os

import httpx

from core.investments import cache

BASE_URL = "https://api.polygon.io"


class PolygonClient:
    def __init__(self):
        key = os.environ.get("POLYGON_API_KEY")
        if not key:
            raise RuntimeError("POLYGON_API_KEY is not set")
        self._key = key
        self._http = httpx.Client(base_url=BASE_URL)

    def _get(self, path: str, params: dict | None = None) -> dict:
        try:
            resp = self._http.get(
                path,
                params=params,
                headers={"Authorization": f"Bearer {self._key}"},
                timeout=15,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Polygon request failed for {path}: {exc}") from exc
        data = resp.json()
        if data is None or (isinstance(data, dict) and data.get("status") == "ERROR"):
            raise RuntimeError(f"Polygon returned an error payload for {path}: {data}")
        return data

    def ticker_details(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:ticker",
            lambda: self._get(f"/v3/reference/tickers/{symbol}"),
            86400,
        )

    def aggregates(self, symbol: str, from_date: str, to_date: str) -> dict:
        symbol = symbol.upper()
        path = f"/v2/aggs/ticker/{symbol}/range/1/day/{from_date}/{to_date}"
        return cache.get_or_fetch(f"{symbol}:aggs:{from_date}:{to_date}", lambda: self._get(path), 21600)

    def dividends(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:dividends",
            lambda: self._get("/v3/reference/dividends", params={"ticker": symbol}),
            86400,
        )

    def sma(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:sma",
            lambda: self._get(f"/v1/indicators/sma/{symbol}"),
            21600,
        )
