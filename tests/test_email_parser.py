import pytest
from core.email_parser import parse

# Matches DBS/POSB card alert format — adjust if your bank differs.
_DBS_SAMPLE = (
    "Dear Customer,\n\n"
    "Your DBS/POSB Debit Card ending in 1234 was charged SGD 25.90 "
    "at GRABFOOD on 23 Jun 2026.\n\n"
    "If you did not authorise this transaction, please call 1800 111 1111."
)

_DBS_SAMPLE_WITH_COMMA = (
    "Your DBS/POSB Debit Card ending in 1234 was charged SGD 1,025.00 "
    "at APPLE.COM/BILL on 23 Jun 2026."
)


def test_parse_extracts_amount():
    result = parse(_DBS_SAMPLE)
    assert result["amount"] == 25.90


def test_parse_extracts_large_amount_with_comma():
    result = parse(_DBS_SAMPLE_WITH_COMMA)
    assert result["amount"] == 1025.00


def test_parse_extracts_merchant():
    result = parse(_DBS_SAMPLE)
    assert result["merchant"] == "GRABFOOD"


def test_parse_extracts_date():
    result = parse(_DBS_SAMPLE)
    assert result["date"] == "2026-06-23"


def test_parse_raises_on_unrecognised_body():
    with pytest.raises(ValueError, match="amount"):
        parse("Hello, your statement is ready.")


def test_parse_raises_with_all_missing_fields():
    with pytest.raises(ValueError) as exc_info:
        parse("completely unrelated email")
    assert "amount" in str(exc_info.value)
