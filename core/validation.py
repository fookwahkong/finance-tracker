from datetime import date, timedelta

from pydantic import ValidationError as PydanticValidationError

from core.models import TransactionCreate

MAX_TEXT_LEN = 500
MAX_ITEM_LEN = 200
MIN_DATE = date(2000, 1, 1)


class ValidationError(Exception):
    pass


def validate_raw_text(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        raise ValidationError("Message is empty.")
    if len(cleaned) > MAX_TEXT_LEN:
        raise ValidationError(f"Message too long (max {MAX_TEXT_LEN} characters).")
    return cleaned


def validate_transaction(data, known_categories: list[str]) -> TransactionCreate:
    try:
        tx = TransactionCreate.model_validate(data)
    except PydanticValidationError as exc:
        raise ValidationError(f"Invalid transaction: {exc}") from exc

    if tx.amount == 0:
        raise ValidationError("Amount cannot be zero.")

    max_date = date.today() + timedelta(days=1)
    if tx.date < MIN_DATE or tx.date > max_date:
        raise ValidationError(f"Date {tx.date.isoformat()} is out of range.")

    item = tx.item.strip()
    if not item:
        raise ValidationError("Item is required.")
    if len(item) > MAX_ITEM_LEN:
        raise ValidationError(f"Item too long (max {MAX_ITEM_LEN} characters).")
    tx.item = item

    # An empty time string would break a Postgres `time` column; treat it as unset.
    if tx.time is not None and not tx.time.strip():
        tx.time = None

    if tx.category is not None and tx.category not in known_categories:
        tx.category = None

    return tx
