from datetime import date, timedelta

import pytest

from core.validation import ValidationError, validate_raw_text, validate_transaction

CATS = ["Food", "Income", "Others"]


def _base(**overrides):
    data = {"date": date.today().isoformat(), "item": "lunch", "amount": -12.5, "category": "Food"}
    data.update(overrides)
    return data


def test_validate_raw_text_strips_and_returns():
    assert validate_raw_text("  coffee 4.50  ") == "coffee 4.50"


def test_validate_raw_text_rejects_empty():
    with pytest.raises(ValidationError):
        validate_raw_text("   ")


def test_validate_raw_text_rejects_too_long():
    with pytest.raises(ValidationError):
        validate_raw_text("x" * 501)


def test_validate_transaction_happy_path():
    tx = validate_transaction(_base(), CATS)
    assert tx.item == "lunch"
    assert tx.amount == -12.5
    assert tx.category == "Food"


def test_validate_transaction_rejects_zero_amount():
    with pytest.raises(ValidationError):
        validate_transaction(_base(amount=0), CATS)


def test_validate_transaction_rejects_absurd_date():
    with pytest.raises(ValidationError):
        validate_transaction(_base(date="1999-12-31"), CATS)


def test_validate_transaction_rejects_far_future_date():
    future = (date.today() + timedelta(days=5)).isoformat()
    with pytest.raises(ValidationError):
        validate_transaction(_base(date=future), CATS)


def test_validate_transaction_rejects_empty_item():
    with pytest.raises(ValidationError):
        validate_transaction(_base(item="   "), CATS)


def test_validate_transaction_rejects_long_item():
    with pytest.raises(ValidationError):
        validate_transaction(_base(item="x" * 201), CATS)


def test_validate_transaction_coerces_unknown_category_to_others():
    tx = validate_transaction(_base(category="Crypto"), CATS)
    assert tx.category == "Others"


def test_validate_transaction_coerces_missing_category_to_others():
    tx = validate_transaction(_base(category=None), CATS)
    assert tx.category == "Others"


def test_validate_transaction_rejects_non_numeric_amount():
    with pytest.raises(ValidationError):
        validate_transaction(_base(amount="lots"), CATS)
