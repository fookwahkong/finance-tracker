import io
from datetime import date as Date

from core.parsing import _get_provider
from core.parsing.extract import extract_json

from .prompt import VISION_SYSTEM_PROMPT

_INSTRUCTIONS = "Extract every transaction from these bank statement page images, in order."

_VALID_DIRECTIONS = {"in", "out"}
_VALID_SOURCES = {"card", "paylah", "paynow", "giro"}


def _render_pages(pdf_bytes: bytes) -> list[bytes]:
    import pdfplumber

    images: list[bytes] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            buf = io.BytesIO()
            page.to_image(resolution=150).original.save(buf, format="PNG")
            images.append(buf.getvalue())
    return images


def _validate_row(raw: dict) -> dict:
    try:
        iso_date = Date.fromisoformat(str(raw["date"])).isoformat()
        item = str(raw["item"])
        amount = float(raw["amount"])
        direction = raw["direction"]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Vision extraction returned a malformed row: {raw!r}") from exc

    if direction not in _VALID_DIRECTIONS:
        raise ValueError(f"Vision extraction returned an invalid direction: {raw!r}")
    if amount <= 0:
        raise ValueError(f"Vision extraction returned a non-positive amount: {raw!r}")

    source = raw.get("source")
    if source not in _VALID_SOURCES:
        source = None

    return {
        "date": iso_date,
        "item": item,
        "amount": amount,
        "direction": direction,
        "source": source,
    }


def extract_rows_from_image(pdf_bytes: bytes) -> list[dict]:
    images = _render_pages(pdf_bytes)

    try:
        raw = _get_provider().complete_vision(VISION_SYSTEM_PROMPT, _INSTRUCTIONS, images)
    except NotImplementedError as exc:
        raise ValueError("Vision extraction requires LLM_PROVIDER=claude") from exc

    parsed = extract_json(raw)
    rows = parsed.get("rows", [])
    return [_validate_row(row) for row in rows]
