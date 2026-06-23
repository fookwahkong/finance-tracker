from datetime import datetime

import pytest

from core.email_parser import parse

# Real DBS PayNow confirmation format (label/value), year omitted by the bank.
_PAYNOW_SAMPLE = (
    "Dear Customer,\n\n"
    "We refer to your PAYNOW dated 20 Jun. We are pleased to confirm that "
    "the transaction was completed.\n\n"
    "Date & Time:    20 Jun 22:11 (SGT)\n"
    "Amount:    SGD47.00\n"
    "From:    ePOSBkids Account A/C ending 6391\n"
    "To:    CHXX WEX LX DAXX (MOBILE ending 3348)\n\n"
    "If unauthorised, please call our DBS hotline."
)

# Real PayLah! Scan & Pay confirmation: merchant payee with periods, no paren.
_PAYLAH_SAMPLE = (
    "We refer to your PayLah! Scan & Pay Transfer dated 22 Jun.\n\n"
    "Date & Time:    22 Jun 15:21 (SGT)\n"
    "Amount:    SGD4.80\n"
    "From:    PayLah! Wallet (Mobile ending 0992)\n"
    "To:    FOMO PAY PTE. LTD.\n"
)

# Synthetic comma-amount variant to cover thousands separators.
_SCANPAY_SAMPLE = (
    "Date & Time:    23 Jun 07:22 (SGT)\n"
    "Amount:    SGD1,025.00\n"
    "To:    CHXX CHXX HEXX REGINXXX\n"
)


def test_parse_extracts_amount():
    assert parse(_PAYNOW_SAMPLE)["amount"] == 47.00


def test_parse_extracts_large_amount_with_comma():
    assert parse(_SCANPAY_SAMPLE)["amount"] == 1025.00


def test_parse_drops_masked_payee_detail():
    assert parse(_PAYNOW_SAMPLE)["merchant"] == "CHXX WEX LX DAXX"


def test_parse_keeps_plain_payee():
    assert parse(_SCANPAY_SAMPLE)["merchant"] == "CHXX CHXX HEXX REGINXXX"


def test_parse_keeps_merchant_with_periods():
    result = parse(_PAYLAH_SAMPLE)
    assert result["merchant"] == "FOMO PAY PTE. LTD."
    assert result["amount"] == 4.80


def test_parse_assumes_current_year_for_date():
    assert parse(_PAYNOW_SAMPLE)["date"] == f"{datetime.now().year}-06-20"


def test_parse_raises_on_unrecognised_body():
    with pytest.raises(ValueError, match="amount"):
        parse("Hello, your statement is ready.")


def test_parse_raises_with_all_missing_fields():
    with pytest.raises(ValueError) as exc_info:
        parse("completely unrelated email")
    assert "amount" in str(exc_info.value)
