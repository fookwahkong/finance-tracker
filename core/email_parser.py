import re
from datetime import datetime

# Matches DBS PayLah!/PayNow transfer confirmation emails, e.g.:
#
#   Date & Time:    20 Jun 22:11 (SGT)
#   Amount:         SGD47.00
#   To:             CHXX WEX LX DAXX (MOBILE ending 3348)
#
# Fields are anchored to their labels rather than parsed out of a sentence,
# since this email format is a label/value form, not narrative text. The "To:"
# value is the payee; any trailing "(MOBILE ending ...)" / "(A/C ...)" is dropped.
_AMOUNT_RE = re.compile(r'Amount:\s*SGD\s*([\d,]+\.\d{2})')
_DATE_RE = re.compile(r'Date\s*&\s*Time:\s*(\d{1,2}\s+[A-Za-z]+)\s+\d{1,2}:\d{2}')
_MERCHANT_RE = re.compile(r'^\s*To:\s*(.+?)(?:\s*\(.*\))?$', re.MULTILINE)

def parse(body: str) -> dict:
    amount_m = _AMOUNT_RE.search(body)
    merchant_m = _MERCHANT_RE.search(body)
    date_m = _DATE_RE.search(body)

    missing = [
        name for name, m in [("amount", amount_m), ("merchant", merchant_m), ("date", date_m)]
        if m is None
    ]
    if missing:
        raise ValueError(f"Could not extract {', '.join(missing)} from email body")

    # The email omits the year, so assume the current year.
    day_month = date_m.group(1)
    parsed_date = datetime.strptime(f"{day_month} {datetime.now().year}", "%d %b %Y").date()

    return {
        "merchant": merchant_m.group(1).strip(),
        "amount": float(amount_m.group(1).replace(",", "")),
        "date": parsed_date.isoformat(),
    }
