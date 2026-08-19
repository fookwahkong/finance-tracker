import { describe, it, expect } from "vitest";
import {
  averageDailySpend,
  belongsToGroup,
  categoryRowsForDay,
  dailyTotals,
  dayNumber,
  daysOfTrip,
  defaultDateForGroup,
  groupTotals,
  includedOutOfRange,
  incomeForDay,
  isWithinRange,
  periodForGroup,
  runningTotalThrough,
  transactionsForGroup,
} from "./travel";

const JAPAN = { id: "g1", name: "Japan", start_date: "2026-08-18", end_date: "2026-08-26" };

const tx = (id, date, amount, category = "Food & Drink") => ({ id, date, amount, category });

describe("membership", () => {
  it("includes a transaction inside the range", () => {
    expect(belongsToGroup(tx("t1", "2026-08-20", -40), JAPAN)).toBe(true);
  });

  it("includes both boundary days", () => {
    expect(belongsToGroup(tx("t1", "2026-08-18", -40), JAPAN)).toBe(true);
    expect(belongsToGroup(tx("t2", "2026-08-26", -40), JAPAN)).toBe(true);
  });

  it("excludes the days either side of the range", () => {
    expect(belongsToGroup(tx("t1", "2026-08-17", -40), JAPAN)).toBe(false);
    expect(belongsToGroup(tx("t2", "2026-08-27", -40), JAPAN)).toBe(false);
  });

  it("lets an exclude override beat an in-range date", () => {
    // Rent that auto-debited mid-trip.
    expect(belongsToGroup(tx("t1", "2026-08-20", -1800), JAPAN, { t1: "exclude" })).toBe(false);
  });

  it("lets an include override beat an out-of-range date", () => {
    // Flights booked six weeks before departure.
    expect(belongsToGroup(tx("t9", "2026-07-04", -880), JAPAN, { t9: "include" })).toBe(true);
  });

  it("ignores a timestamp suffix on the date", () => {
    expect(belongsToGroup(tx("t1", "2026-08-20T09:15:00Z", -40), JAPAN)).toBe(true);
  });

  it("filters a list against a group and its overrides", () => {
    const transactions = [
      tx("t1", "2026-08-20", -40),
      tx("t2", "2026-08-20", -1800, "Housing"),
      tx("t3", "2026-07-04", -880, "Travel"),
      tx("t4", "2026-09-15", -25),
    ];
    const overrides = [
      { transaction_id: "t2", mode: "exclude" },
      { transaction_id: "t3", mode: "include" },
    ];
    expect(transactionsForGroup(transactions, JAPAN, overrides).map((t) => t.id)).toEqual([
      "t1",
      "t3",
    ]);
  });

  it("returns nothing when there is no group selected", () => {
    expect(transactionsForGroup([tx("t1", "2026-08-20", -40)], null)).toEqual([]);
  });

  it("picks out the pre-trip bookings pulled in by an include override", () => {
    const transactions = [tx("t1", "2026-08-20", -40), tx("t9", "2026-07-04", -880, "Travel")];
    const overrides = [{ transaction_id: "t9", mode: "include" }];
    expect(includedOutOfRange(transactions, JAPAN, overrides).map((t) => t.id)).toEqual(["t9"]);
  });
});

describe("isWithinRange", () => {
  it("treats a single-day trip as containing its one day", () => {
    const day = { start_date: "2026-08-18", end_date: "2026-08-18" };
    expect(isWithinRange("2026-08-18", day)).toBe(true);
    expect(isWithinRange("2026-08-19", day)).toBe(false);
  });
});

describe("daysOfTrip", () => {
  it("lists every day inclusive of both ends", () => {
    const days = daysOfTrip(JAPAN);
    expect(days).toHaveLength(9);
    expect(days[0]).toBe("2026-08-18");
    expect(days[8]).toBe("2026-08-26");
  });

  it("crosses a month boundary", () => {
    expect(daysOfTrip({ start_date: "2026-08-28", end_date: "2026-09-03" })).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(daysOfTrip({ start_date: "2026-12-30", end_date: "2027-01-02" })).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("returns a single day for a one-day trip", () => {
    expect(daysOfTrip({ start_date: "2026-08-18", end_date: "2026-08-18" })).toEqual([
      "2026-08-18",
    ]);
  });

  it("returns nothing for a missing group", () => {
    expect(daysOfTrip(null)).toEqual([]);
    expect(daysOfTrip({})).toEqual([]);
  });
});

describe("dayNumber", () => {
  it("numbers trip days from 1", () => {
    expect(dayNumber("2026-08-18", JAPAN)).toBe(1);
    expect(dayNumber("2026-08-26", JAPAN)).toBe(9);
  });

  it("returns null for a date outside the trip, such as a pre-booked flight", () => {
    expect(dayNumber("2026-07-04", JAPAN)).toBeNull();
  });
});

describe("groupTotals", () => {
  it("reports spend as a positive magnitude and keeps income separate", () => {
    const totals = groupTotals([tx("t1", "2026-08-20", -40), tx("t2", "2026-08-21", 15)]);
    expect(totals).toEqual({ spend: 40, income: 15, net: -25, count: 2 });
  });

  it("is zero for an empty trip", () => {
    expect(groupTotals([])).toEqual({ spend: 0, income: 0, net: 0, count: 0 });
  });
});

describe("dailyTotals", () => {
  it("sums spend per day and leaves untouched days at zero", () => {
    const days = daysOfTrip(JAPAN);
    const totals = dailyTotals(
      [
        tx("t1", "2026-08-18", -40),
        tx("t2", "2026-08-18", -60),
        tx("t3", "2026-08-20", -25),
        tx("t4", "2026-08-20", 100), // income does not reduce the day's spend
      ],
      days,
    );
    expect(totals["2026-08-18"]).toBe(100);
    expect(totals["2026-08-19"]).toBe(0);
    expect(totals["2026-08-20"]).toBe(25);
  });

  it("ignores transactions outside the day list", () => {
    const totals = dailyTotals([tx("t9", "2026-07-04", -880)], daysOfTrip(JAPAN));
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });
});

describe("categoryRowsForDay", () => {
  const transactions = [
    tx("t1", "2026-08-20", -12, "Food & Drink"),
    tx("t2", "2026-08-20", -48, "Food & Drink"),
    tx("t3", "2026-08-20", -90, "Shopping"),
    tx("t4", "2026-08-20", 30, "Work"), // income
    tx("t5", "2026-08-21", -70, "Transport"), // another day
  ];

  it("groups the day's spending by category, biggest first", () => {
    const rows = categoryRowsForDay(transactions, "2026-08-20");
    expect(rows.map((r) => r.category)).toEqual(["Shopping", "Food & Drink"]);
    expect(rows[0].amount).toBe(90);
    expect(rows[1].amount).toBe(60);
  });

  it("computes each category's share of the day", () => {
    const rows = categoryRowsForDay(transactions, "2026-08-20");
    expect(rows[0].share).toBeCloseTo(0.6);
    expect(rows[1].share).toBeCloseTo(0.4);
  });

  it("excludes income from the spend rows", () => {
    const rows = categoryRowsForDay(transactions, "2026-08-20");
    expect(rows.some((r) => r.category === "Work")).toBe(false);
  });

  it("keeps each category's transactions, largest first", () => {
    const rows = categoryRowsForDay(transactions, "2026-08-20");
    const food = rows.find((r) => r.category === "Food & Drink");
    expect(food.items.map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("buckets a missing category under Uncategorized", () => {
    const rows = categoryRowsForDay([{ id: "t1", date: "2026-08-20", amount: -10 }], "2026-08-20");
    expect(rows[0].category).toBe("Uncategorized");
  });

  it("returns nothing for a day with no spending", () => {
    expect(categoryRowsForDay(transactions, "2026-08-22")).toEqual([]);
  });
});

describe("incomeForDay", () => {
  it("returns only that day's credits", () => {
    const transactions = [
      tx("t1", "2026-08-20", 30, "Work"),
      tx("t2", "2026-08-20", -12),
      tx("t3", "2026-08-21", 50, "Work"),
    ];
    expect(incomeForDay(transactions, "2026-08-20").map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("averageDailySpend", () => {
  it("averages only the days that had spending", () => {
    expect(averageDailySpend({ a: 100, b: 0, c: 50 })).toBe(75);
  });

  it("is zero when nothing was spent", () => {
    expect(averageDailySpend({ a: 0, b: 0 })).toBe(0);
    expect(averageDailySpend({})).toBe(0);
  });
});

describe("runningTotalThrough", () => {
  it("accumulates from the first day through the given one", () => {
    const days = ["2026-08-18", "2026-08-19", "2026-08-20"];
    const map = { "2026-08-18": 100, "2026-08-19": 50, "2026-08-20": 25 };
    expect(runningTotalThrough(map, days, "2026-08-19")).toBe(150);
    expect(runningTotalThrough(map, days, "2026-08-20")).toBe(175);
  });
});

describe("defaultDateForGroup", () => {
  it("uses today when the trip is under way", () => {
    expect(defaultDateForGroup(JAPAN, new Date("2026-08-21T10:00:00Z"))).toBe("2026-08-21");
  });

  it("falls back to the first day for a trip that is not today", () => {
    expect(defaultDateForGroup(JAPAN, new Date("2026-02-01T10:00:00Z"))).toBe("2026-08-18");
  });
});

describe("periodForGroup", () => {
  it("shapes a group into the period the shared Overview takes", () => {
    const period = periodForGroup({ ...JAPAN, destination: "Tokyo" });
    expect(period.start).toBe("2026-08-18");
    expect(period.end).toBe("2026-08-26");
    expect(period.label).toBe("Japan · Tokyo");
    expect(period.slug).toBe("japan-2026-08-18");
  });

  it("omits the destination when there is none", () => {
    expect(periodForGroup(JAPAN).label).toBe("Japan");
  });

  it("is null without a group", () => {
    expect(periodForGroup(null)).toBeNull();
  });
});
