"""Caching seam for investment provider calls.

Feature 1 is a pass-through: it calls the fetch function and returns the
result with no storage. The interface exists so a real cache (in-memory or
Supabase) can be slotted in later without touching call sites. The Polygon
free tier allows only 5 calls/minute, so this is where rate-limit handling
will live.
"""
from typing import Callable


def get_or_fetch(key: str, fetch_fn: Callable[[], dict]) -> dict:
    return fetch_fn()
