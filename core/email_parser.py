import re
from datetime import datetime

# Three DBS email formats are supported, all label/value or short narrative
# forms, so fields are anchored to their labels/phrases.
#
# 1. Transfer out (PayNow / PayLah! / Scan & Pay) — money leaving, e.g.:
#       Date & Time:    20 Jun 22:11 (SGT)
#       Amount:         SGD47.00
#       To:             CHXX WEX LX DAXX (MOBILE ending 3348)
#    The "To:" value is the payee; any trailing "(MOBILE ending ...)" is dropped.
#
# 2. GIRO deduction — money leaving, e.g.:
#       Date and Time:    23 Jun 17:30 (SGT)
#       Paying to:        SYFE PTE. LTD. 8 CROSS STREET #21-01 ...
#       Payment amount:   SGD 133.73
#
# 3. Received via PayNow — money coming in, narrative form, e.g.:
#       You have received SGD 116.15 via PayNow on 06 Jun 2026 00:05 SGT.
#       From: CHUA WEN LI DANA
#    The "From:" value is the payer.
#
# parse() returns the amount as a positive magnitude plus a "direction"
# ("in" / "out"); the caller applies the sign. \s* (not [ \t]*) spans the
# newlines the HTML-to-text step inserts between a label cell and its value.

_AMOUNT_RE = re.compile(r"Amount:\s*SGD\s*([\d,]+\.\d{2})")
_DATE_RE = re.compile(r"Date\s*&\s*Time:\s*(\d{1,2}\s+[A-Za-z]+)\s+\d{1,2}:\d{2}")
_MERCHANT_RE = re.compile(r"^\s*To:\s*(.+?)(?:\s*\(.*\))?$", re.MULTILINE)

_GIRO_AMOUNT_RE = re.compile(r"Payment amount:\s*SGD\s*([\d,]+\.\d{2})")
_GIRO_DATE_RE = re.compile(r"Date and Time:\s*(\d{1,2}\s+[A-Za-z]+)\s+\d{1,2}:\d{2}")
_GIRO_MERCHANT_RE = re.compile(r"Paying to:\s*(.+)")

_RECEIVED_AMOUNT_RE = re.compile(r"received\s*SGD\s*([\d,]+\.\d{2})", re.IGNORECASE)
_RECEIVED_DATE_RE = re.compile(r"on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})")
_RECEIVED_MERCHANT_RE = re.compile(r"From:\s*(.+)")


def _to_date(captured: str, has_year: bool) -> str:
    if has_year:
        parsed = datetime.strptime(captured, "%d %b %Y").date()
    else:
        # These formats omit the year, so assume the current year.
        parsed = datetime.strptime(f"{captured} {datetime.now().year}", "%d %b %Y").date()
    return parsed.isoformat()


def parse(body: str) -> dict:
    if _RECEIVED_AMOUNT_RE.search(body):
        return _parse(
            body,
            _RECEIVED_AMOUNT_RE,
            _RECEIVED_DATE_RE,
            _RECEIVED_MERCHANT_RE,
            fmt="received",
            direction="in",
            date_has_year=True,
        )
    if _GIRO_AMOUNT_RE.search(body):
        return _parse(
            body,
            _GIRO_AMOUNT_RE,
            _GIRO_DATE_RE,
            _GIRO_MERCHANT_RE,
            fmt="giro",
            direction="out",
            date_has_year=False,
        )
    return _parse(
        body,
        _AMOUNT_RE,
        _DATE_RE,
        _MERCHANT_RE,
        fmt="transfer",
        direction="out",
        date_has_year=False,
    )


def _parse(
    body, amount_re, date_re, merchant_re, fmt: str, direction: str, date_has_year: bool
) -> dict:
    amount_m = amount_re.search(body)
    merchant_m = merchant_re.search(body)
    date_m = date_re.search(body)

    missing = [
        name
        for name, m in [("amount", amount_m), ("merchant", merchant_m), ("date", date_m)]
        if m is None
    ]
    if missing:
        raise ValueError(f"Could not extract {', '.join(missing)} from email body")

    return {
        "merchant": merchant_m.group(1).strip(),
        "amount": float(amount_m.group(1).replace(",", "")),
        "date": _to_date(date_m.group(1), date_has_year),
        "format": fmt,
        "direction": direction,
    }
