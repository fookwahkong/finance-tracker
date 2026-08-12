import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MonthVsMonth from "./MonthVsMonth";

// The month abbreviation also appears in the tile-row grid above the table,
// so scope the lookup to a <tr> specifically.
function tableRowFor(monthAbbr) {
  const cell = screen.getAllByText(monthAbbr).find((el) => el.tagName === "TD");
  return cell.closest("tr");
}

describe("MonthVsMonth", () => {
  it("reflects claim reimbursements in the Money in/Money out table, not raw transaction amounts", () => {
    const transactions = [
      { id: "debit-1", date: "2026-08-01", item: "Dinner", amount: -100, category: "Food & Drink" },
      { id: "credit-1", date: "2026-08-02", item: "Alex PayNow", amount: 75, category: "Others" },
      { id: "salary", date: "2026-08-01", item: "Salary", amount: 3000, category: "Work" },
    ];
    const claims = [{ id: "claim-1", debit_tx_id: "debit-1", expected: 75 }];
    const claimLinks = [{ id: "link-1", claim_id: "claim-1", credit_tx_id: "credit-1", allocated_amount: 75 }];

    render(<MonthVsMonth transactions={transactions} claims={claims} claimLinks={claimLinks} />);

    const augRow = tableRowFor("Aug");
    // Debit: -100 + 75 received = -25. Credit: 75 - 75 claimed = 0 (not real income).
    // So Money out = $25, Money in = $3,000 (just salary, the $75 PayNow nets to nothing).
    expect(within(augRow).getByText("$3,000.00")).toBeInTheDocument();
    expect(within(augRow).getByText("$25.00")).toBeInTheDocument();
    expect(within(augRow).getByText("+$2,975.00")).toBeInTheDocument();
  });

  it("matches raw transaction totals when there are no claims", () => {
    const transactions = [
      { id: "t1", date: "2026-03-01", item: "Groceries", amount: -50, category: "Groceries" },
      { id: "t2", date: "2026-03-01", item: "Salary", amount: 2000, category: "Work" },
    ];
    render(<MonthVsMonth transactions={transactions} />);

    const marRow = tableRowFor("Mar");
    expect(within(marRow).getByText("$2,000.00")).toBeInTheDocument();
    expect(within(marRow).getByText("$50.00")).toBeInTheDocument();
    expect(within(marRow).getByText("+$1,950.00")).toBeInTheDocument();
  });
});
