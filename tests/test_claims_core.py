import core.claims as claims


def _links(*amounts):
    return [{"allocated_amount": a} for a in amounts]


def test_expected_amount():
    assert claims.expected_amount(100, 25) == 75


def test_received_total_sums_links():
    assert claims.received_total(_links(75, 25)) == 100


def test_received_total_empty():
    assert claims.received_total([]) == 0


def test_remaining():
    assert claims.remaining(75, _links(50)) == 25


def test_variance_over_under_exact():
    assert claims.variance(80, 75) == 5
    assert claims.variance(70, 75) == -5
    assert claims.variance(75, 75) == 0


def test_settlement_amount_clamps_to_expected():
    assert claims.settlement_amount(75, 80) == 75
    assert claims.settlement_amount(75, 70) == 70
    assert claims.settlement_amount(75, 75) == 75


def _net(claim, links):
    """Effective net = -total + received, via settlement_effects pieces."""
    eff = claims.settlement_effects(claim, links)
    received = claims.received_total(links)
    total = claim["expected"] + claim["my_share"]
    eff_spend = total - eff["category_credit_back"]
    if eff["variance_line"] < 0:
        eff_spend += -eff["variance_line"]
    eff_income = max(eff["variance_line"], 0.0)
    return eff_income - eff_spend, received, total


def test_settlement_effects_exact():
    claim = {"expected": 75, "my_share": 25, "category": "Groceries"}
    eff = claims.settlement_effects(claim, _links(75))
    assert eff == {
        "category": "Groceries",
        "category_credit_back": 75,
        "excluded_income": 75,
        "variance_line": 0,
    }
    net, received, total = _net(claim, _links(75))
    assert net == -total + received == -25


def test_settlement_effects_over_books_gift():
    claim = {"expected": 75, "my_share": 25, "category": "Groceries"}
    eff = claims.settlement_effects(claim, _links(80))
    assert eff["variance_line"] == 5
    assert eff["category_credit_back"] == 75
    assert eff["excluded_income"] == 75
    net, received, total = _net(claim, _links(80))
    assert net == -total + received == -20


def test_settlement_effects_under_books_expense():
    claim = {"expected": 75, "my_share": 25, "category": "Groceries"}
    eff = claims.settlement_effects(claim, _links(70))
    assert eff["variance_line"] == -5
    assert eff["category_credit_back"] == 75
    assert eff["excluded_income"] == 70
    net, received, total = _net(claim, _links(70))
    assert net == -total + received == -30


def test_settlement_effects_multi_credit():
    claim = {"expected": 75, "my_share": 25, "category": "Groceries"}
    eff = claims.settlement_effects(claim, _links(40, 35))
    assert eff["variance_line"] == 0
    assert eff["excluded_income"] == 75
