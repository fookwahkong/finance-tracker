"""Financial Modeling Prep REST client.

Returns raw parsed JSON exactly as FMP sends it. Statement endpoints return a
JSON array. Auth is an `apikey` query param. Mirrors the httpx + cache pattern
in polygon.py.
"""
import os

import httpx

from core.investments import cache

BASE_URL = "https://financialmodelingprep.com/stable"


class FMPClient:
    def __init__(self):
        key = os.environ.get("FMP_API_KEY")
        if not key:
            raise RuntimeError("FMP_API_KEY is not set")
        self._key = key
        self._http = httpx.Client(base_url=BASE_URL)

    def _get(self, path: str, params: dict | None = None) -> dict | list:
        params = dict(params or {})
        params["apikey"] = self._key
        try:
            resp = self._http.get(path, params=params, timeout=15)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"FMP request failed for {path}: {exc}") from exc
        data = resp.json()
        if data is None or (isinstance(data, dict) and "Error Message" in data):
            raise RuntimeError(f"FMP returned an error payload for {path}: {data}")
        return data

    def income_statement(self, symbol: str) -> list:
        symbol = symbol.upper()
        return cache.get_or_fetch(f"{symbol}:income", lambda: self._get("/income-statement", {"symbol": symbol}), 604800)

    def balance_sheet(self, symbol: str) -> list:
        symbol = symbol.upper()
        return cache.get_or_fetch(f"{symbol}:balance", lambda: self._get("/balance-sheet-statement", {"symbol": symbol}), 604800)

    def cash_flow(self, symbol: str) -> list:
        symbol = symbol.upper()
        return cache.get_or_fetch(f"{symbol}:cashflow", lambda: self._get("/cash-flow-statement", {"symbol": symbol}), 604800)

    def ratios(self, symbol: str) -> list:
        symbol = symbol.upper()
        return cache.get_or_fetch(f"{symbol}:ratios", lambda: self._get("/ratios", {"symbol": symbol, "limit": 5}), 86400)
