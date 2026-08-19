import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DaySummary from "./DaySummary";

const JAPAN = {
  id: "g1",
  name: "Japan",
  destination: "Tokyo",
  start_date: "2026-08-18",
  end_date: "2026-08-22",
  overrides: [],
};

const transactions = [
  { id: "t1", date: "2026-08-18", item: "Airport train", amount: -12, category: "Transport" },
  { id: "t2", date: "2026-08-18", item: "Ramen", amount: -18, category: "Food & Drink" },
  { id: "t3", date: "2026-08-18", item: "Konbini snacks", amount: -6, category: "Food & Drink" },
  { id: "t4", date: "2026-08-19", item: "Museum", amount: -25, category: "Personal" },
  { id: "t5", date: "2026-08-30", item: "Post-trip groceries", amount: -40, category: "Groceries" },
];

const renderDay = (props = {}) => render(
  <DaySummary
    group={JAPAN}
    transactions={transactions}
    claims={[]}
    claimLinks={[]}
    {...props}
  />,
);

const categoryTable = () => screen.getByText("Spending by category").closest(".card");

describe("DaySummary", () => {
  it("opens on the first day of the trip", () => {
    renderDay();
    expect(screen.getByText(/Day 1 · Tue 18 Aug/)).toBeInTheDocument();
  });

  it("renders a chip per trip day with that day's total", () => {
    renderDay();
    const chips = screen.getAllByRole("button", { name: /^Day \d/ });
    expect(chips).toHaveLength(5); // 18-22 Aug inclusive
    expect(within(chips[0]).getByText("$36")).toBeInTheDocument(); // 12 + 18 + 6
    expect(within(chips[2]).getByText("—")).toBeInTheDocument(); // nothing on day 3
  });

  it("groups the day's spending by category, biggest first", () => {
    renderDay();
    const rows = within(categoryTable()).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Food & Drink"); // 18 + 6 = 24
    expect(rows[0]).toHaveTextContent("−$24.00");
    expect(rows[1]).toHaveTextContent("Transport"); // 12
    expect(rows[1]).toHaveTextContent("−$12.00");
  });

  it("shows each category's share of the day", () => {
    renderDay();
    const rows = within(categoryTable()).getAllByRole("button");
    expect(within(rows[0]).getByText("67%")).toBeInTheDocument(); // 24 / 36
    expect(within(rows[1]).getByText("33%")).toBeInTheDocument(); // 12 / 36
  });

  it("expands a category to its individual transactions", () => {
    renderDay();
    expect(screen.queryByText("Ramen")).not.toBeInTheDocument();

    fireEvent.click(within(categoryTable()).getAllByRole("button")[0]);

    expect(screen.getByText("Ramen")).toBeInTheDocument();
    expect(screen.getByText("Konbini snacks")).toBeInTheDocument();
  });

  it("moves to another day via its chip", () => {
    renderDay();
    fireEvent.click(screen.getByRole("button", { name: /Day 2/ }));

    expect(screen.getByText(/Day 2 · Wed 19 Aug/)).toBeInTheDocument();
    expect(within(categoryTable()).getAllByRole("button")[0]).toHaveTextContent("Personal");
  });

  it("steps days with the arrow buttons and stops at the ends", () => {
    renderDay();
    expect(screen.getByRole("button", { name: /previous day/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next day/i }));
    expect(screen.getByText(/Day 2 ·/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous day/i })).not.toBeDisabled();
  });

  it("names an empty day rather than showing a bare zero", () => {
    renderDay();
    fireEvent.click(screen.getByRole("button", { name: /Day 3/ }));

    expect(screen.getByText("No spending on Day 3 (20 Aug).")).toBeInTheDocument();
  });

  it("excludes transactions outside the trip", () => {
    renderDay();
    expect(screen.queryByText("Post-trip groceries")).not.toBeInTheDocument();
  });

  it("reports the day total, the trip average, and the running total", () => {
    renderDay();
    const stats = document.querySelector(".day-stats");

    expect(within(stats).getByText("Spent today").nextSibling).toHaveTextContent("$36.00");
    // Average is over days that had spending: (36 + 25) / 2 = 30.50 — a rest
    // day must not drag the "typical day" figure down.
    expect(within(stats).getByText("Trip daily average").nextSibling).toHaveTextContent("$30.50");
    expect(within(stats).getByText("Trip so far").nextSibling).toHaveTextContent("$36.00");
  });

  it("accumulates the running total through the selected day", () => {
    renderDay();
    fireEvent.click(screen.getByRole("button", { name: /Day 2/ }));

    const stats = document.querySelector(".day-stats");
    expect(within(stats).getByText("Trip so far").nextSibling).toHaveTextContent("$61.00"); // 36 + 25
  });

  it("keeps income out of the category rows and lists it separately", () => {
    renderDay({
      transactions: [
        ...transactions,
        { id: "t6", date: "2026-08-18", item: "Hotel refund", amount: 45, category: "Travel" },
      ],
    });

    expect(within(categoryTable()).queryByText("Travel")).not.toBeInTheDocument();
    const moneyIn = screen.getByText("Money in on this day").closest(".card");
    expect(within(moneyIn).getByText("Hotel refund")).toBeInTheDocument();
    expect(within(moneyIn).getByText("+$45.00")).toBeInTheDocument();
  });

  it("uses claim-adjusted amounts so totals match the Overview subtab", () => {
    const claims = [{ id: "c1", debit_tx_id: "t2", expected: 9 }];
    const claimLinks = [{ id: "l1", claim_id: "c1", credit_tx_id: "c-tx", allocated_amount: 9 }];
    renderDay({ claims, claimLinks });

    // Ramen -18 with 9 reimbursed reads as -9, so Food & Drink falls from
    // 24 to 9 + 6 = 15 — the reimbursed half is simply not the user's spend.
    const rows = within(categoryTable()).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Food & Drink");
    expect(rows[0]).toHaveTextContent("−$15.00");
    expect(rows[1]).toHaveTextContent("Transport");
    // And the day total follows it down: 36 - 9 = 27.
    const stats = document.querySelector(".day-stats");
    expect(within(stats).getByText("Spent today").nextSibling).toHaveTextContent("$27.00");
  });

  it("lists an include-override booking under its own pre-trip section", () => {
    const group = { ...JAPAN, overrides: [{ transaction_id: "flight", mode: "include" }] };
    renderDay({
      group,
      transactions: [
        ...transactions,
        { id: "flight", date: "2026-07-04", item: "ANA flights", amount: -880, category: "Travel" },
      ],
    });

    const preTrip = screen.getByText("Booked before the trip").closest(".card");
    expect(within(preTrip).getByText("ANA flights")).toBeInTheDocument();
    // It has no trip day, so it must not land in a day's category rows.
    expect(within(categoryTable()).queryByText("Travel")).not.toBeInTheDocument();
  });

  it("drops a transaction an exclude override pushed out of the trip", () => {
    const group = { ...JAPAN, overrides: [{ transaction_id: "t4", mode: "exclude" }] };
    renderDay({ group });
    fireEvent.click(screen.getByRole("button", { name: /Day 2/ }));

    expect(screen.getByText("No spending on Day 2 (19 Aug).")).toBeInTheDocument();
  });
});
