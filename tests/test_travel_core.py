import pytest

from core.travel import TravelError, find_overlap, overlaps, validate_group, validate_mode


def _group(start, end, name="Trip", **extra):
    return {"name": name, "start_date": start, "end_date": end, **extra}


def test_validate_group_normalises_a_clean_payload():
    result = validate_group(
        {
            "name": "  Japan  ",
            "destination": "  Tokyo  ",
            "start_date": "2026-08-18",
            "end_date": "2026-08-26",
        }
    )
    assert result == {
        "name": "Japan",
        "destination": "Tokyo",
        "start_date": "2026-08-18",
        "end_date": "2026-08-26",
    }


def test_validate_group_allows_a_single_day_trip():
    result = validate_group(_group("2026-08-18", "2026-08-18"))
    assert result["start_date"] == result["end_date"] == "2026-08-18"


def test_validate_group_treats_a_blank_destination_as_absent():
    assert (
        validate_group(_group("2026-08-18", "2026-08-26", destination="   "))["destination"] is None
    )


@pytest.mark.parametrize("name", ["", "   "])
def test_validate_group_rejects_a_blank_name(name):
    with pytest.raises(TravelError, match="name"):
        validate_group(_group("2026-08-18", "2026-08-26", name=name))


def test_validate_group_rejects_an_overlong_name():
    with pytest.raises(TravelError, match="too long"):
        validate_group(_group("2026-08-18", "2026-08-26", name="x" * 81))


def test_validate_group_rejects_an_inverted_range():
    with pytest.raises(TravelError, match="end date cannot be before"):
        validate_group(_group("2026-08-26", "2026-08-18"))


def test_validate_group_rejects_an_unparseable_date():
    with pytest.raises(TravelError, match="valid date"):
        validate_group(_group("not-a-date", "2026-08-26"))


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [
        # (start, end) pairs — both ends inclusive.
        (("2026-08-18", "2026-08-26"), ("2026-09-01", "2026-09-05"), False),  # disjoint
        (("2026-08-18", "2026-08-26"), ("2026-08-26", "2026-09-02"), True),  # touching
        (("2026-08-18", "2026-08-26"), ("2026-08-20", "2026-08-22"), True),  # nested
        (("2026-08-18", "2026-08-26"), ("2026-08-18", "2026-08-26"), True),  # identical
        (("2026-08-18", "2026-08-26"), ("2026-08-24", "2026-09-02"), True),  # partial
        (
            ("2026-08-18", "2026-08-26"),
            ("2026-08-10", "2026-08-17"),
            False,
        ),  # adjacent, no shared day
    ],
)
def test_overlaps_truth_table(a, b, expected):
    assert overlaps(_group(*a), _group(*b)) is expected
    assert overlaps(_group(*b), _group(*a)) is expected  # symmetric


def test_find_overlap_names_the_clashing_trip():
    existing = [
        {"id": "1", "name": "Japan", "start_date": "2026-08-18", "end_date": "2026-08-26"},
        {"id": "2", "name": "Bali", "start_date": "2026-10-01", "end_date": "2026-10-07"},
    ]
    clash = find_overlap(_group("2026-10-05", "2026-10-09"), existing)
    assert clash["name"] == "Bali"


def test_find_overlap_ignores_the_group_being_edited():
    existing = [{"id": "1", "name": "Japan", "start_date": "2026-08-18", "end_date": "2026-08-26"}]
    # Re-dating Japan onto dates it already covers is not a clash with itself.
    assert find_overlap(_group("2026-08-20", "2026-08-28"), existing, ignore_id="1") is None
    assert find_overlap(_group("2026-08-20", "2026-08-28"), existing) is not None


def test_find_overlap_returns_none_when_there_are_no_groups():
    assert find_overlap(_group("2026-08-18", "2026-08-26"), []) is None


@pytest.mark.parametrize("mode", ["include", "exclude", "  INCLUDE  "])
def test_validate_mode_accepts_both_directions(mode):
    assert validate_mode(mode) in {"include", "exclude"}


@pytest.mark.parametrize("mode", ["", None, "maybe"])
def test_validate_mode_rejects_anything_else(mode):
    with pytest.raises(TravelError):
        validate_mode(mode)
