import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  settleClaim: vi.fn().mockResolvedValue({}),
  linkCredit: vi.fn().mockResolvedValue({}),
  unlinkCredit: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/claims", () => apiMocks);

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

  it("assigns a selected credit to a specific participant", async () => {
    apiMocks.linkCredit.mockClear();
    const onChanged = vi.fn();
    render(<Claims claims={claims} transactions={transactions} onChanged={onChanged} />);

    const alex = screen.getByRole("article", { name: /alex repayment/i });
    fireEvent.click(within(alex).getByRole("button", { name: /assign repayment/i }));

    expect(screen.getByRole("dialog", { name: /assign repayment from alex/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/credit transaction/i), { target: { value: "credit-1" } });
    fireEvent.change(screen.getByLabelText(/amount to assign/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /assign \$10\.00/i }));

    await waitFor(() => expect(apiMocks.linkCredit).toHaveBeenCalledWith("claim-1", "alex-1", {
      credit_tx_id: "credit-1",
      allocated_amount: 10,
    }));
    expect(onChanged).toHaveBeenCalled();
  });
});
