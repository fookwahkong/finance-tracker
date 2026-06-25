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
# A block ends at a page's "Balance Carried Forward" or, on the final page
# (which has no carried-forward line), the "Total Balance Carried Forward".
_CARRIED_FORWARD = re.compile(r"^(Total )?Balance Carried Forward")

# A detail line that is a single unbroken alphanumeric token (>=10 chars) is a
# reference/hash, not a merchant — skip it when looking for the merchant name.
_REF_LIKE = re.compile(r"^[A-Z0-9]{10,}$")
# Debit-card merchant lines end with a country code + posting date, e.g.
# "OTTIE PANCAKES SINGAPORE SGP 29APR" — strip that trailing noise.
_TRAILING_LOC_DATE = re.compile(r"\s+[A-Z]{2,3}\s+\d{2}[A-Z]{3}$")


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


def _merchant(dtype: str, detail_lines: list[str]) -> str:
    # A "FROM:"/"TO:" party (PayNow / transfers) is the truest merchant name.
    for line in detail_lines:
        upper = line.upper()
        if upper.startswith("FROM:") or upper.startswith("TO:"):
            return line.split(":", 1)[1].strip()

    # Otherwise the first "wordy" detail line — skipping reference/hash/number
    # tokens — is the merchant or activity.
    for line in detail_lines:
        candidate = line.strip().rstrip(":").strip()
        if not candidate:
            continue
        if " " not in candidate and (
            _REF_LIKE.match(candidate) or candidate.isdigit() or candidate.upper().startswith("REF")
        ):
            continue
        return _TRAILING_LOC_DATE.sub("", candidate).strip()

    # No usable detail (e.g. "Interest Earned") — fall back to the type.
    return dtype


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
    blob = " ".join([dtype, *detail_lines])
    row = {
        "date": iso,
        "item": _merchant(dtype, detail_lines),
        "amount": amount,
        "direction": "in" if delta > 0 else "out",
        "source": _source(dtype, blob),
    }
    return row, balance


def _is_noise(line: str) -> bool:
    # Page-trailer artifact like "4 4 4 4 4" — every token is a single char.
    tokens = line.split()
    return bool(tokens) and all(len(t) == 1 for t in tokens)


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

        if cur is not None and not _is_noise(line):
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
