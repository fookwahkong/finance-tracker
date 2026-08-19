"""Pure, DB-free rules for travel groups.

A travel group is a named date range. Which transactions belong to it is
*derived* at read time from that range (plus per-transaction overrides), never
stored on the transaction — so re-dating a transaction in the Spending tab
re-buckets it with no sync step. See docs/design/travel-tab.md.

Membership derivation itself lives in `frontend/src/lib/travel.js`, not here:
the browser is its only consumer today, and one rule implemented in two
languages is two rules waiting to disagree. This module holds the validation
and the overlap rule, which the API must enforce server-side.
"""

from datetime import date as Date

MAX_NAME_LEN = 80
MAX_DESTINATION_LEN = 120
VALID_MODES = {"include", "exclude"}


class TravelError(Exception):
    """Invalid travel-group input. Routers translate this into a 422."""


def _parse_date(value, field: str) -> Date:
    if isinstance(value, Date):
        return value
    try:
        return Date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise TravelError(f"{field} must be a valid date (YYYY-MM-DD).") from exc


def validate_group(payload: dict) -> dict:
    """Return a clean, insertable group dict, or raise TravelError."""
    name = str(payload.get("name") or "").strip()
    if not name:
        raise TravelError("Give this trip a name.")
    if len(name) > MAX_NAME_LEN:
        raise TravelError(f"Trip name is too long (max {MAX_NAME_LEN} characters).")

    destination = str(payload.get("destination") or "").strip()
    if len(destination) > MAX_DESTINATION_LEN:
        raise TravelError(f"Destination is too long (max {MAX_DESTINATION_LEN} characters).")

    start = _parse_date(payload.get("start_date"), "Start date")
    end = _parse_date(payload.get("end_date"), "End date")
    if end < start:
        raise TravelError("The end date cannot be before the start date.")

    return {
        "name": name,
        "destination": destination or None,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }


def overlaps(candidate: dict, existing: dict) -> bool:
    """True when two trips share at least one day.

    Both ends are inclusive, so a trip ending 26 Aug and one starting 26 Aug
    *do* overlap — one day belongs to one trip. This mirrors the database's
    `daterange(start_date, end_date, '[]')` exclusion constraint exactly; it
    exists so the API can return a readable message naming the clashing trip
    instead of surfacing a raw constraint violation.
    """
    a_start = _parse_date(candidate["start_date"], "Start date")
    a_end = _parse_date(candidate["end_date"], "End date")
    b_start = _parse_date(existing["start_date"], "Start date")
    b_end = _parse_date(existing["end_date"], "End date")
    return a_start <= b_end and b_start <= a_end


def find_overlap(
    candidate: dict, existing_groups: list[dict], ignore_id: str | None = None
) -> dict | None:
    """The first already-saved trip clashing with `candidate`, if any."""
    for group in existing_groups:
        if ignore_id is not None and group.get("id") == ignore_id:
            continue
        if overlaps(candidate, group):
            return group
    return None


def validate_mode(mode) -> str:
    """Validate an override mode ('include' pulls a pre-trip booking in,
    'exclude' pushes a mid-trip GIRO debit out)."""
    cleaned = str(mode or "").strip().lower()
    if cleaned not in VALID_MODES:
        raise TravelError("Override mode must be 'include' or 'exclude'.")
    return cleaned
