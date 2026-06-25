import io
import re
from datetime import datetime

# In the extracted text, each transaction's first line carries the date, the
# transaction type, then the amount and running balance:
#     01/05/2026 FAST Payment / Receipt 350.00 28,437.62
# The lines that follow (payee, references) are detail, until the next dated
# line or a "Balance Carried/Brought Forward" marker.
_MONEY = r"[\d,]+\.\d{2}"
_TXN_LINE = re.compile(rf"^(\d{{2}}/\d{{2}}/\d{{4}})\s+(.*?)\s+({_MONEY})\s+({_MONEY})\s*$")
_BROUGHT_FORWARD = re.compile(rf"^Balance Brought Forward\s+({_MONEY})\s*$")
_CARRIED_FORWARD = re.compile(r"^Balance Carried Forward")


def _money(text: str) -> float:
    return float(text.replace(",", ""))


def _source(dtype: str, blob: str) -> str | None:
    t = dtype.upper()
    b = blob.upper()
    if t.startswith("DEBIT CARD"):
        return "card"
    if "PAYLAH" in b:
        return "paylah"
    if "PAYNOW" in b:
        return "paynow"
    if t.startswith("FAST COLLECTION") or t.startswith("D2P") or "GIRO" in b:
        return "giro"
    return None


def _build(date_str, dtype, detail_lines, amt, bal, prev_balance):
    amount = _money(amt)
    balance = _money(bal)
    delta = round(balance - prev_balance, 2)
    if abs(abs(delta) - amount) > 0.01:
        raise ValueError(
            f"Checksum failed at {date_str} {dtype!r}: "
            f"balance delta {delta} != stated amount {amount}"
        )
    iso = datetime.strptime(date_str, "%d/%m/%Y").date().isoformat()
    description = "\n".join([dtype, *detail_lines]).strip()
    blob = " ".join([dtype, *detail_lines])
    row = {
        "date": iso,
        "description": description,
        "amount": amount,
        "direction": "in" if delta > 0 else "out",
        "source": _source(dtype, blob),
    }
    return row, balance


def _parse_lines(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    prev_balance: float | None = None
    cur: dict | None = None  # {"date", "type", "amt", "bal", "detail": [...]}

    def flush():
        nonlocal cur, prev_balance
        if cur is None:
            return
        row, prev_balance = _build(
            cur["date"], cur["type"], cur["detail"], cur["amt"], cur["bal"], prev_balance
        )
        rows.append(row)
        cur = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        bf = _BROUGHT_FORWARD.match(line)
        if bf:
            flush()
            prev_balance = _money(bf.group(1))
            continue

        if _CARRIED_FORWARD.match(line):
            flush()
            continue

        txn = _TXN_LINE.match(line) if prev_balance is not None else None
        if txn:
            flush()
            date_str, dtype, amt, bal = txn.groups()
            cur = {"date": date_str, "type": dtype.strip(), "amt": amt, "bal": bal, "detail": []}
            continue

        if cur is not None:
            cur["detail"].append(line)

    flush()
    return rows


def extract_rows(pdf_bytes: bytes) -> list[dict]:
    import pdfplumber

    lines: list[str] = []
    any_text = False
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                any_text = True
            lines.extend(text.split("\n"))

    if not any_text:
        raise ValueError("This looks like a scanned PDF; only digital statements are supported.")

    return _parse_lines(lines)
