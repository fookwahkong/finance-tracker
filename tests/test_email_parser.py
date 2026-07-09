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
    "Date & Time:    23 Jun 07:22 (SGT)\nAmount:    SGD1,025.00\nTo:    CHXX CHXX HEXX REGINXXX\n"
)

# Real DBS GIRO deduction format: distinct labels ("Payment amount", "Paying to",
# "Date and Time" with no "&") and a full payee name + address on one line.
_GIRO_SAMPLE = (
    "Our GIRO payment is successful\n"
    "Transaction Ref: SGA23066JKFY55OG\n\n"
    "Dear Customer,\n\n"
    "Your GIRO deduction is successful.\n\n"
    "Details\n"
    "Date and Time:    23 Jun 17:30 (SGT)\n"
    "From:    DBS/POSB A/C ending 6391\n"
    "Paying to:    SYFE PTE. LTD. 8 CROSS STREET #21-01 MANULIFE TOWER SINGAPORE 048424\n"
    "Payment amount:    SGD 133.73\n"
    "Bill Reference number:    17600215125274-vAGvGW7Xo_oq2_XRZc_1\n"
)

# Real DBS "received via PayNow" credit notice: narrative form, full date with
# year, and the counterparty in "From:" (incoming money, positive).
_RECEIVED_SAMPLE = (
    "Transaction Ref: 1780675527388700563400C100000000000\n\n"
    "Dear Customer,\n\n"
    "You have received SGD 116.15 via PayNow on 06 Jun 2026 00:05 SGT.\n\n"
    "From: CHUA WEN LI DANA\n"
    "To: Your DBS/ POSB account ending 6391\n\n"
    "Thank you for banking with us.\n"
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


def test_parse_tags_transfer_format():
    assert parse(_PAYNOW_SAMPLE)["format"] == "transfer"


def test_parse_transfer_direction_is_out():
    assert parse(_PAYNOW_SAMPLE)["direction"] == "out"


def test_parse_giro_amount():
    assert parse(_GIRO_SAMPLE)["amount"] == 133.73


def test_parse_giro_keeps_full_payee():
    result = parse(_GIRO_SAMPLE)
    assert result["merchant"] == (
        "SYFE PTE. LTD. 8 CROSS STREET #21-01 MANULIFE TOWER SINGAPORE 048424"
    )


def test_parse_giro_date():
    assert parse(_GIRO_SAMPLE)["date"] == f"{datetime.now().year}-06-23"


def test_parse_tags_giro_format():
    assert parse(_GIRO_SAMPLE)["format"] == "giro"


def test_parse_giro_direction_is_out():
    assert parse(_GIRO_SAMPLE)["direction"] == "out"


def test_parse_received_amount():
    assert parse(_RECEIVED_SAMPLE)["amount"] == 116.15


def test_parse_received_payer_is_merchant():
    assert parse(_RECEIVED_SAMPLE)["merchant"] == "CHUA WEN LI DANA"


def test_parse_received_date_with_year():
    assert parse(_RECEIVED_SAMPLE)["date"] == "2026-06-06"


def test_parse_received_format_and_direction():
    result = parse(_RECEIVED_SAMPLE)
    assert result["format"] == "received"
    assert result["direction"] == "in"


def test_parse_raises_on_unrecognised_body():
    with pytest.raises(ValueError, match="amount"):
        parse("Hello, your statement is ready.")


def test_parse_raises_with_all_missing_fields():
    with pytest.raises(ValueError) as exc_info:
        parse("completely unrelated email")
    assert "amount" in str(exc_info.value)
