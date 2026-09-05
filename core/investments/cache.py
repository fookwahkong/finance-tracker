"""Supabase-backed cache for investment provider calls.

One row per cache key in the investment_cache table. On a hit within TTL the
stored payload is returned; on a miss or stale entry, fetch_fn is called and
the result is upserted. Validation is the provider's responsibility — fetch_fn
must return valid data or raise; this layer never inspects the payload.

The cache is an optimisation, never a dependency: if the investment_cache
table is unreachable, callers still get live data. And a stale entry is a
better answer than an error, so an upstream failure falls back to whatever
we last stored rather than propagating — see get_or_fetch.
"""

from datetime import datetime, timezone
from typing import Callable

from core.db import supabase
from core.logging import get_logger

Payload = dict | list

logger = get_logger("cache")


def _read(key: str) -> tuple[Payload | None, float | None]:
    """Return (payload, age_seconds) for a cached row, or (None, None).

    A cache read that fails is reported as a miss: an unreachable cache table
    must not take down the caller that only wanted the data behind it.
    """
    try:
        result = (
            supabase.table("investment_cache")
            .select("data,fetched_at")
            .eq("key", key)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.warning("cache_read_failed", key=key, error=str(exc))
        return None, None

    # maybe_single().execute() returns None (not a response) on a cache miss.
    row = result.data if result else None
    if not row:
        return None, None
    fetched_at = datetime.fromisoformat(row["fetched_at"])
    age = (datetime.now(timezone.utc) - fetched_at).total_seconds()
    return row["data"], age


def _write(key: str, payload: Payload) -> None:
    try:
        supabase.table("investment_cache").upsert(
            {
                "key": key,
                "data": payload,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception as exc:
        # The caller already has its answer; failing to memoise it is not
        # worth failing the request over.
        logger.warning("cache_write_failed", key=key, error=str(exc))


def peek(key: str, ttl_seconds: int) -> Payload | None:
    """Return the cached payload if present and fresh; never fetches."""
    payload, age = _read(key)
    if payload is None or age >= ttl_seconds:
        return None
    return payload


def get_or_fetch(key: str, fetch_fn: Callable[[], Payload], ttl_seconds: int) -> Payload:
    payload, age = _read(key)
    if payload is not None and age < ttl_seconds:
        return payload

    try:
        fresh = fetch_fn()
    except Exception as exc:
        # A stale payload beats no payload. This matters most for FX: an
        # exchange rate a day or two old still converts a transaction
        # perfectly well, and refusing to record it because a free upstream
        # API blipped is the worse outcome.
        if payload is not None:
            logger.warning("fetch_failed_serving_stale", key=key, age=age, error=str(exc))
            return payload
        raise

    _write(key, fresh)
    return fresh
