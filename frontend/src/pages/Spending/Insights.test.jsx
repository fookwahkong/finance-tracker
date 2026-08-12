import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithClient } from "../../testUtils";

const getBudgets = vi.fn();
const getSubscriptions = vi.fn();
const getMonthlyReport = vi.fn();
vi.mock("../../api/client", () => ({
  getBudgets: (...args) => getBudgets(...args),
  getSubscriptions: (...args) => getSubscriptions(...args),
  getMonthlyReport: (...args) => getMonthlyReport(...args),
}));

const downloadMonthlyReport = vi.fn();
vi.mock("./lib/report", () => ({
  downloadMonthlyReport: (...args) => downloadMonthlyReport(...args),
}));

import Insights from "./Insights";

const TODAY = new Date(2026, 7, 15); // August 15, 2026

describe("Insights", () => {
  beforeEach(() => {
    getBudgets.mockResolvedValue([{ category: "Food", amount: 100 }]);
    getSubscriptions.mockResolvedValue([{ type: "bill", item: "Netflix", amount: 15 }]);
    getMonthlyReport.mockResolvedValue({
      total_income: 3000,
      total_expenses: -108,
      net: 2892,
      breakdown: { Salary: 3000, Food: -90, Bills: -18 },
    });
    downloadMonthlyReport.mockClear();
  });

  it("renders real insight values from the fetched and passed-in data", async () => {
    const transactions = [
      { date: "2026-08-02", amount: -90, item: "Groceries", category: "Food" },
      { date: "2026-07-02", amount: -50, category: "Food" },
      { date: "2026-08-01", amount: -18, item: "Netflix", category: "Bills" },
      { date: "2026-05-01", amount: -15, item: "Netflix", category: "Bills" },
    ];
    renderWithClient(<Insights transactions={transactions} today={TODAY} />);

    expect(await screen.findByText(/Groceries/)).toBeInTheDocument();
    expect(screen.getByText("$90.00")).toBeInTheDocument();
  });

  it("reflects claim reimbursements in Biggest transaction, not the raw amount paid", async () => {
    const transactions = [
      { id: "debit-1", date: "2026-08-02", amount: -500, item: "Group dinner", category: "Food & Drink" },
    ];
    const claims = [{ id: "claim-1", debit_tx_id: "debit-1", expected: 450 }];
    const claimLinks = [{ id: "link-1", claim_id: "claim-1", credit_tx_id: "credit-1", allocated_amount: 450 }];
    renderWithClient(<Insights transactions={transactions} claims={claims} claimLinks={claimLinks} today={TODAY} />);

    // -500 + 450 received = your real -$50 share, not the full $500 paid.
    expect(await screen.findByText("$50.00")).toBeInTheDocument();
    expect(screen.queryByText("$500.00")).not.toBeInTheDocument();
  });

  it("renders graceful empty states when there is not enough data", async () => {
    getBudgets.mockResolvedValue([]);
    getSubscriptions.mockResolvedValue([]);
    renderWithClient(<Insights transactions={[]} today={TODAY} />);

    const empties = await screen.findAllByText(/not enough data/i);
    expect(empties.length).toBeGreaterThan(0);
  });

  it("downloads the monthly report when the button is clicked", async () => {
    renderWithClient(<Insights transactions={[]} today={TODAY} />);

    const button = await screen.findByRole("button", { name: /download.*report/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    expect(downloadMonthlyReport).toHaveBeenCalledWith(
      { total_income: 3000, total_expenses: -108, net: 2892, breakdown: { Salary: 3000, Food: -90, Bills: -18 } },
      "2026-08"
    );
  });
});
