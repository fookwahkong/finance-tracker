import re
from datetime import datetime

# Adjust these patterns to match your bank's email format.
# The patterns below match DBS/POSB card alert emails:
#   "was charged SGD 25.90 at GRABFOOD on 23 Jun 2026"
_AMOUNT_RE = re.compile(r'SGD\s+([\d,]+\.\d{2})')
_MERCHANT_RE = re.compile(r'at\s+(.+?)\s+on\s+\d{1,2}\s+\w')
_DATE_RE = re.compile(r'on\s+(\d{1,2}\s+\w+\s+\d{4})')


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

    return {
        "merchant": merchant_m.group(1).strip(),
        "amount": float(amount_m.group(1).replace(",", "")),
        "date": datetime.strptime(date_m.group(1), "%d %b %Y").date().isoformat(),
    }
