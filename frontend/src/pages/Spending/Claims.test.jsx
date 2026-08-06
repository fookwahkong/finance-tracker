import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Claims from "./Claims";

const claims = [{
  id: "claim-1",
  debit_tx_id: "debit-1",
  total: 100,
  status: "open",
  participants: [
    { id: "owner-1", name: "You", is_owner: true, share_amount: 33.34, share_percent: 100 / 3, links: [] },
    { id: "alex-1", name: "Alex", is_owner: false, share_amount: 33.33, share_percent: 100 / 3, links: [{ id: "link-1", credit_tx_id: "credit-0", allocated_amount: 20 }] },
    { id: "sam-1", name: "Sam", is_owner: false, share_amount: 33.33, share_percent: 100 / 3, links: [{ id: "link-2", credit_tx_id: "credit-2", allocated_amount: 40 }] },
  ],
}];

const transactions = [
  { id: "debit-1", item: "Dinner", amount: -100, date: "2026-08-01" },
  { id: "credit-0", item: "Alex PayNow", amount: 20, date: "2026-08-02" },
  { id: "credit-1", item: "Available PayNow", amount: 50, date: "2026-08-03" },
  { id: "credit-2", item: "Sam PayNow", amount: 40, date: "2026-08-04" },
];

describe("Claims", () => {
  it("shows separate participant balances and overpayments", () => {
    render(<Claims claims={claims} transactions={transactions} onChanged={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Dinner" })).toBeInTheDocument();
    expect(screen.getByText("Your share").nextSibling).toHaveTextContent("$33.34");

    const alex = screen.getByRole("article", { name: /alex repayment/i });
    expect(within(alex).getByText("$33.33")).toBeInTheDocument();
    expect(within(alex).getByText("Received").nextSibling).toHaveTextContent("$20.00");
    expect(within(alex).getByText("$13.33")).toBeInTheDocument();

    const sam = screen.getByRole("article", { name: /sam repayment/i });
    expect(within(sam).getByText(/overpaid/i).nextSibling).toHaveTextContent("$6.67");
    expect(within(sam).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("does not expose repayment assignment or linked repayment controls", () => {
    render(<Claims claims={claims} transactions={transactions} onChanged={vi.fn()} />);

    expect(screen.queryByText(/available repayments/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign repayment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unlink/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Alex PayNow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("claim-drag-preview")).not.toBeInTheDocument();
  });
});
