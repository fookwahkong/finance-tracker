"""Finnhub REST client.

Returns raw parsed JSON exactly as Finnhub sends it. company-news returns a
JSON array; profile and earnings return objects. Auth is the X-Finnhub-Token
header. Mirrors the httpx + cache pattern in polygon.py.
"""
import os

import httpx

from core.investments import cache

BASE_URL = "https://finnhub.io/api/v1"


class FinnhubClient:
    def __init__(self):
        key = os.environ.get("FINNHUB_API_KEY")
        if not key:
            raise RuntimeError("FINNHUB_API_KEY is not set")
        self._key = key
        self._http = httpx.Client(base_url=BASE_URL)

    def _get(self, path: str, params: dict | None = None) -> dict | list:
        try:
            resp = self._http.get(
                path,
                params=params,
                headers={"X-Finnhub-Token": self._key},
                timeout=15,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Finnhub request failed for {path}: {exc}") from exc
        data = resp.json()
        if data is None or (isinstance(data, dict) and "error" in data):
            raise RuntimeError(f"Finnhub returned an error payload for {path}: {data}")
        return data

    def company_profile(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:profile",
            lambda: self._get("/stock/profile2", {"symbol": symbol}),
            86400,
        )

    def company_news(self, symbol: str, from_date: str, to_date: str) -> list:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:news:{from_date}",
            lambda: self._get("/company-news", {"symbol": symbol, "from": from_date, "to": to_date}),
            86400,
        )

    def market_news(self) -> list:
        return cache.get_or_fetch(
            "market:news",
            lambda: self._get("/news", {"category": "general"}),
            3600,
        )

    def earnings_calendar_range(self, from_date: str, to_date: str) -> dict:
        return cache.get_or_fetch(
            f"earnings-calendar:{from_date}:{to_date}",
            lambda: self._get("/calendar/earnings", {"from": from_date, "to": to_date}),
            86400,
        )

    def quote(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:quote",
            lambda: self._get("/quote", {"symbol": symbol}),
            30,
        )

    def earnings_calendar(self, symbol: str) -> dict:
        symbol = symbol.upper()
        return cache.get_or_fetch(
            f"{symbol}:earnings",
            lambda: self._get("/calendar/earnings", {"symbol": symbol}),
            86400,
        )
