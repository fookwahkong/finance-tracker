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
    assert r["description"].startswith("FAST Payment / Receipt")
    assert "CHUA WEN LI DANA" in r["description"]


def test_debit_card_row_is_out_and_card():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[1]
    assert r["date"] == "2026-05-02"
    assert r["amount"] == 2.40
    assert r["direction"] == "out"
    assert r["source"] == "card"


def test_paylah_topup_source():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[2]["source"] == "paylah"
    assert rows[2]["direction"] == "out"


def test_giro_collection_source():
    rows = _parse_lines(SAMPLE_LINES)
    assert rows[3]["source"] == "giro"
    assert rows[3]["amount"] == 129.34


def test_inline_interest_earned():
    rows = _parse_lines(SAMPLE_LINES)
    r = rows[4]
    assert r["date"] == "2026-05-31"
    assert r["amount"] == 1.01
    assert r["direction"] == "in"
    assert r["source"] is None
    assert r["description"] == "Interest Earned"


def test_checksum_failure_raises():
    bad = [
        "Balance Brought Forward 100.00",
        "01/05/2026 Debit Card transaction 5.00 90.00",  # delta is 10.00 but amount says 5.00
        "SOMETHING SGP",
    ]
    import pytest
    with pytest.raises(ValueError):
        _parse_lines(bad)
