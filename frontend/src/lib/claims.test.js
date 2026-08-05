import { describe, it, expect } from "vitest";
import { receivedTotal, remaining, variance, linksByClaim, claimAdjustments, allocatedByCredit } from "./claims";
import * as claimMath from "./claims";

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

  it("applies to open claims too", () => {
    const claims = [{ id: "c1", debit_tx_id: "d1", expected: 75, category: "Groceries", status: "open" }];
    expect(claimAdjustments(tx, claims, [link("c1", 80)])).toEqual([
      {month:"2026-06", category:"Groceries", amount: 75}]);
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

describe("allocatedByCredit", () => {
  it("sums allocated amounts per credit across all claims", () => {
    const links = [
      { id: "l1", claim_id: "c1", credit_tx_id: "cr1", allocated_amount: 10 },
      { id: "l2", claim_id: "c2", credit_tx_id: "cr1", allocated_amount: 10 },
      { id: "l3", claim_id: "c1", credit_tx_id: "cr2", allocated_amount: 5 },
    ];
    expect(allocatedByCredit(links)).toEqual({ cr1: 20, cr2: 5 });
  });

  it("returns an empty object for no links", () => {
    expect(allocatedByCredit([])).toEqual({});
  });
});

describe("calculateClaimSplit", () => {
  it("is available from the claims helpers", () => {
    expect(typeof claimMath.calculateClaimSplit).toBe("function");
  });

  it("splits equally and assigns the leftover cent to You", () => {
    const split = claimMath.calculateClaimSplit(100, ["Alex", "Sam"]);

    expect(split.valid).toBe(true);
    expect(split.mode).toBe("equal");
    expect(split.participants.map((person) => person.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(split.participants.map((person) => person.percent)).toEqual([
      100 / 3,
      100 / 3,
      100 / 3,
    ]);
    expect(split.ownerAmount).toBe(33.34);
    expect(split.expectedAmount).toBe(66.66);
  });

  it("uses a custom owner percentage and divides the remainder equally", () => {
    const split = claimMath.calculateClaimSplit(100, ["Alex", "Sam"], 40);

    expect(split.mode).toBe("custom");
    expect(split.ownerPercent).toBe(40);
    expect(split.participants.map((person) => person.percent)).toEqual([40, 30, 30]);
    expect(split.participants.map((person) => person.amount)).toEqual([40, 30, 30]);
  });

  it("recalculates equal shares when a participant is removed", () => {
    const split = claimMath.calculateClaimSplit(100, ["Alex"]);

    expect(split.participants.map((person) => person.amount)).toEqual([50, 50]);
    expect(split.participants.map((person) => person.percent)).toEqual([50, 50]);
  });

  it("rejects blank and case-insensitively duplicated names", () => {
    const split = claimMath.calculateClaimSplit(100, ["Alex", " alex ", " "]);

    expect(split.valid).toBe(false);
    expect(split.errors.names).toMatch(/blank/i);
    expect(split.errors.duplicates).toMatch(/unique/i);
  });

  it("rejects custom owner percentages outside the claim range", () => {
    expect(claimMath.calculateClaimSplit(100, ["Alex"], 100).errors.ownerPercent).toMatch(/less than 100/i);
    expect(claimMath.calculateClaimSplit(100, ["Alex"], -1).errors.ownerPercent).toMatch(/at least 0/i);
  });
});

describe("claim participants", () => {
  it("normalizes server participants and derives their balances", () => {
    const [participant] = claimMath.participantsForClaim({
      id: "c1",
      participants: [{
        id: "p1",
        name: "Alex",
        is_owner: false,
        share_amount: 30,
        share_percent: 30,
        links: [link("c1", 20)],
      }],
    });

    expect(participant).toMatchObject({ id: "p1", name: "Alex", isOwner: false, shareAmount: 30 });
    expect(claimMath.participantBalance(participant)).toEqual({
      owed: 30,
      received: 20,
      remaining: 10,
      overpaid: 0,
      progress: 2 / 3,
    });
  });

  it("creates a readable fallback for legacy aggregate claims", () => {
    const participants = claimMath.participantsForClaim({
      id: "c1",
      total: 100,
      my_share: 40,
      expected: 60,
      counterparty: "Alex & Sam",
      links: [link("c1", 25)],
    });

    expect(participants).toHaveLength(2);
    expect(participants[0]).toMatchObject({ name: "You", isOwner: true, shareAmount: 40 });
    expect(participants[1]).toMatchObject({ name: "Alex & Sam", isOwner: false, shareAmount: 60, legacy: true });
    expect(claimMath.participantBalance(participants[1]).remaining).toBe(35);
  });
});

describe("claimCreatePayload", () => {
  it("includes participant-aware fields and current-backend compatibility fields", () => {
    const split = claimMath.calculateClaimSplit(100, ["Alex", "Sam"]);

    expect(claimMath.claimCreatePayload("tx-1", split)).toEqual({
      debit_tx_id: "tx-1",
      participant_names: ["Alex", "Sam"],
      split_mode: "equal",
      my_share_percent: 100 / 3,
      my_share: 33.34,
      counterparty: "Alex, Sam",
    });
  });
});

describe("linksForClaims", () => {
  it("collects both participant-aware and legacy repayment links", () => {
    const legacyLink = link("legacy", 10, "legacy-link");
    const participantLink = link("modern", 20, "participant-link");

    expect(claimMath.linksForClaims([
      { id: "legacy", links: [legacyLink] },
      { id: "modern", participants: [{ id: "p1", links: [participantLink] }] },
    ])).toEqual([legacyLink, participantLink]);
  });
});
