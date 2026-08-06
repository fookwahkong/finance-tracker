import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  linkCredit: vi.fn().mockResolvedValue({}),
  settleClaim: vi.fn(),
  reopenClaim: vi.fn(),
  deleteClaim: vi.fn(),
  unlinkCredit: vi.fn(),
  createClaim: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  createTransaction: vi.fn(), updateTransaction: vi.fn(), deleteTransaction: vi.fn(),
}));
vi.mock("../../api/claims", () => apiMocks);

import Overview from "./Overview";

const transactions = [
  { id: "debit-1", date: "2026-08-01", item: "Dinner", amount: -100, category: "Food & Drink" },
  { id: "credit-1", date: "2026-08-02", item: "Alex PayNow", amount: 50, category: "Others" },
];
const claims = [{
  id: "claim-1",
  debit_tx_id: "debit-1",
  total: 100,
  expected: 60,
  status: "open",
  participants: [
    { id: "owner-1", name: "You", is_owner: true, share_amount: 40, share_percent: 40, links: [] },
    { id: "alex-1", name: "Alex", is_owner: false, share_amount: 60, share_percent: 60, links: [] },
  ],
}];

describe("Overview repayment assignment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00"));
    apiMocks.linkCredit.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("opens the in-app repayment dialog when a credit is dropped on a person", () => {
    render(<Overview transactions={transactions} categories={[]} claims={claims} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle linked credits/i }));

    const alex = screen.getByRole("article", { name: /alex repayment/i });
    const credit = screen.getByText("Alex PayNow").closest(".row");
    const values = new Map();
    const dataTransfer = {
      setData: (type, value) => values.set(type, value),
      getData: (type) => values.get(type) || "",
      setDragImage: vi.fn(),
    };
    const dragStart = createEvent.dragStart(credit, { dataTransfer });
    Object.defineProperties(dragStart, { clientX: { value: 120 }, clientY: { value: 120 } });
    fireEvent(credit, dragStart);
    fireEvent.dragEnter(alex);
    fireEvent.drop(alex, { dataTransfer });

    expect(screen.getByRole("dialog", { name: /assign repayment from alex/i })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText(/credit transaction/i)).toHaveValue("credit-1");
  });
});
