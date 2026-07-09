"""Supabase-backed cache for investment provider calls.

One row per cache key in the investment_cache table. On a hit within TTL the
stored payload is returned; on a miss or stale entry, fetch_fn is called and
the result is upserted. Validation is the provider's responsibility — fetch_fn
must return valid data or raise; this layer never inspects the payload.
"""

from datetime import datetime, timezone
from typing import Callable

from core.db import supabase

Payload = dict | list


def peek(key: str, ttl_seconds: int) -> Payload | None:
    """Return the cached payload if present and fresh; never fetches."""
    result = (
        supabase.table("investment_cache")
        .select("data,fetched_at")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    row = result.data if result else None
    if not row:
        return None
    fetched_at = datetime.fromisoformat(row["fetched_at"])
    if (datetime.now(timezone.utc) - fetched_at).total_seconds() >= ttl_seconds:
        return None
    return row["data"]


def get_or_fetch(key: str, fetch_fn: Callable[[], Payload], ttl_seconds: int) -> Payload:
    result = (
        supabase.table("investment_cache")
        .select("data,fetched_at")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    # maybe_single().execute() returns None (not a response) on a cache miss.
    row = result.data if result else None
    if row:
        fetched_at = datetime.fromisoformat(row["fetched_at"])
        if (datetime.now(timezone.utc) - fetched_at).total_seconds() < ttl_seconds:
            return row["data"]
    fresh = fetch_fn()
    supabase.table("investment_cache").upsert(
        {
            "key": key,
            "data": fresh,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return fresh
