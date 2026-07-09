from core.statement.extract import _parse_lines
from tests.fixtures.dbs_statement_lines import SAMPLE_LINES


def test_parses_all_five_transactions():
    rows = _parse_lines(SAMPLE_LINES)
    assert len(rows) == 5


def test_incoming_paynow_row():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[0]
    assert r["date"] == "2026-05-01"
    assert r["amount"] == 350.00
    assert r["direction"] == "in"
    assert r["source"] == "paynow"
    # item is the sender (FROM party), not the transaction type.
    assert r["item"] == "CHUA WEN LI DANA"


def test_debit_card_item_is_merchant_not_type():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[1]
    assert r["date"] == "2026-05-02"
    assert r["amount"] == 2.40
    assert r["direction"] == "out"
    assert r["source"] == "card"
    # trailing country code + posting date are stripped off the merchant.
    assert r["item"] == "OTTIE PANCAKES SINGAPORE"


def test_paylah_topup_source_and_item():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[2]["source"] == "paylah"
    assert rows[2]["direction"] == "out"
    assert rows[2]["item"] == "TOP-UP TO PAYLAH!"


def test_giro_collection_skips_reference_hashes():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[3]["source"] == "giro"
    assert rows[3]["amount"] == 129.34
    assert rows[3]["item"] == "COLLECTION PAYMENT"


def test_inline_interest_earned():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[4]
    assert r["date"] == "2026-05-31"
    assert r["amount"] == 1.01
    assert r["direction"] == "in"
    assert r["source"] is None
    assert r["item"] == "Interest Earned"


def test_carried_forward_flushes_across_page_break():
    lines = [
        "Balance Brought Forward 100.00",
        "01/05/2026 Debit Card transaction 10.00 90.00",
        "SHOP ALPHA SGP 01MAY",
        "Balance Carried Forward 90.00",
        "Balance Brought Forward 90.00",
        "02/05/2026 Debit Card transaction 5.00 85.00",
        "SHOP BETA SGP 02MAY",
    ]
    rows = _parse_lines(lines)
    assert [r["item"] for r in rows] == ["SHOP ALPHA", "SHOP BETA"]


def test_checksum_failure_raises():
    bad = [
        "Balance Brought Forward 100.00",
        "01/05/2026 Debit Card transaction 5.00 90.00",  # delta is 10.00 but amount says 5.00
        "SOMETHING SGP",
    ]
    import pytest

    with pytest.raises(ValueError):
        _parse_lines(bad)
