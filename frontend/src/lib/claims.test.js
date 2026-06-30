import { describe, it, expect } from "vitest";
import { receivedTotal, remaining, variance, linksByClaim, claimAdjustments } from "./claims";

const link = (claim_id, allocated_amount, id = claim_id + "-l") => ({
  id, claim_id, credit_tx_id: "cr", allocated_amount,
});

describe("receivedTotal / remaining / variance", () => {
  it("sums allocations", () => {
    expect(receivedTotal([link("c1", 40), link("c1", 35)])).toBe(75);
  });
  it("remaining = expected - received", () => {
    expect(remaining(75, [link("c1", 50)])).toBe(25);
  });
  it("variance over/under/exact", () => {
    expect(variance(80, 75)).toBe(5);
    expect(variance(70, 75)).toBe(-5);
    expect(variance(75, 75)).toBe(0);
  });
});

describe("linksByClaim", () => {
  it("groups by claim_id", () => {
    const grouped = linksByClaim([link("c1", 10), link("c2", 20), link("c1", 5)]);
    expect(grouped.c1).toHaveLength(2);
    expect(grouped.c2).toHaveLength(1);
  });
});

describe("claimAdjustments", () => {
  const tx = [{ id: "d1", date: "2026-06-01", amount: -100, category: "Groceries" }];

  it("ignores open claims", () => {
    const claims = [{ id: "c1", debit_tx_id: "d1", expected: 75, category: "Groceries", status: "open" }];
    expect(claimAdjustments(tx, claims, [link("c1", 80)])).toEqual([]);
  });

  it("settled exact: subtract 75 in debit month", () => {
    const claims = [{ id: "c1", debit_tx_id: "d1", expected: 75, category: "Groceries", status: "settled" }];
    expect(claimAdjustments(tx, claims, [link("c1", 75)])).toEqual([
      { month: "2026-06", category: "Groceries", amount: 75 },
    ]);
  });

  it("settled over: capped at expected (75)", () => {
    const claims = [{ id: "c1", debit_tx_id: "d1", expected: 75, category: "Groceries", status: "settled" }];
    expect(claimAdjustments(tx, claims, [link("c1", 80)])[0].amount).toBe(75);
  });

  it("settled under: capped at received (70)", () => {
    const claims = [{ id: "c1", debit_tx_id: "d1", expected: 75, category: "Groceries", status: "settled" }];
    expect(claimAdjustments(tx, claims, [link("c1", 70)])[0].amount).toBe(70);
  });
});
