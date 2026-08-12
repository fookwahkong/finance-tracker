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

  it("opens the repayment dialog with a person picker and the claim's own month via the Choose repayment button", () => {
    render(<Overview transactions={transactions} categories={[]} claims={claims} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle linked credits/i }));
    fireEvent.click(screen.getByRole("button", { name: /choose repayment/i }));

    const dialog = screen.getByRole("dialog", { name: /assign repayment from alex/i });
    expect(within(dialog).getByLabelText(/person/i)).toHaveValue("alex-1");
    expect(within(dialog).getByLabelText(/year/i)).toHaveValue("2026");
    expect(within(dialog).getByLabelText(/month/i)).toHaveValue("08");
    expect(within(dialog).getByLabelText(/credit transaction/i)).toHaveValue("credit-1");
  });

  it("hides Choose repayment once a claim is settled", () => {
    const settledClaims = [{ ...claims[0], status: "settled" }];
    render(<Overview transactions={transactions} categories={[]} claims={settledClaims} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle linked credits/i }));

    expect(screen.queryByRole("button", { name: /choose repayment/i })).not.toBeInTheDocument();
  });
});

describe("Overview stats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  // The stat tiles (Total Spending/Income/Net Cash Flow/Transactions) are
  // gone entirely — Money Out/Money In are the only totals on this page now.
  it("renders no top stat tiles", () => {
    const transactions = [
      { id: "debit-1", date: "2026-08-01", item: "Dinner", amount: -100, category: "Food & Drink" },
      { id: "salary", date: "2026-08-01", item: "Salary", amount: 3000, category: "Work" },
    ];
    render(<Overview transactions={transactions} categories={[]} claims={[]} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);

    expect(screen.queryByText("Total Spending")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Income")).not.toBeInTheDocument();
    expect(screen.queryByText("Net Cash Flow")).not.toBeInTheDocument();
    expect(screen.queryByText("Transactions")).not.toBeInTheDocument();
  });
});

describe("Money out / Money in cards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  const netTransactions = [
    { id: "salary", date: "2026-08-01", item: "Salary", amount: 3000, category: "Work" },
    { id: "groceries-spend", date: "2026-08-02", item: "NTUC", amount: -100, category: "Groceries" },
    { id: "groceries-refund", date: "2026-08-05", item: "Store credit refund", amount: 20, category: "Groceries" },
    { id: "transport", date: "2026-08-03", item: "MRT", amount: -50, category: "Transport" },
  ];

  function catRowsIn(card) {
    return within(card).getAllByRole("button").filter((row) => row.className.includes("cat-row"));
  }

  it("shows a category with both spend and income as two independent rows, never netted, each section sorted by its own magnitude", () => {
    render(<Overview transactions={netTransactions} categories={[]} claims={[]} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);

    const moneyOutCard = screen.getByText("Money out").closest(".card");
    const moneyInCard = screen.getByText("Money in").closest(".card");

    // Money out (spend only, unrelated to what the category also earns):
    // Groceries ($100) > Transport ($50).
    expect(catRowsIn(moneyOutCard).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Groceries"),
      expect.stringContaining("Transport"),
    ]);
    // Money in (income only): Work ($3,000) > Groceries ($20) — Groceries
    // appears here too, as its own honest total, not netted against its spend.
    expect(catRowsIn(moneyInCard).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Work"),
      expect.stringContaining("Groceries"),
    ]);

    const rowFor = (card, name) => catRowsIn(card).find((row) => within(row).queryByText(name));

    const groceriesOutRow = rowFor(moneyOutCard, "Groceries");
    expect(within(groceriesOutRow).getByText("−$100.00")).toHaveClass("neg");
    expect(within(groceriesOutRow).getByText("67%")).toBeInTheDocument(); // 100 / (100 + 50)

    const transportRow = rowFor(moneyOutCard, "Transport");
    expect(within(transportRow).getByText("−$50.00")).toHaveClass("neg");
    expect(within(transportRow).getByText("33%")).toBeInTheDocument(); // 50 / 150

    const workRow = rowFor(moneyInCard, "Work");
    expect(within(workRow).getByText("+$3,000.00")).toHaveClass("pos");
    expect(within(workRow).getByText("99%")).toBeInTheDocument(); // 3000 / 3020

    const groceriesInRow = rowFor(moneyInCard, "Groceries");
    expect(within(groceriesInRow).getByText("+$20.00")).toHaveClass("pos");
    expect(within(groceriesInRow).getByText("1%")).toBeInTheDocument(); // 20 / 3020
  });

  it("excludes a fully-claimed credit's amount from Money In, and shows a partially-claimed credit's unclaimed remainder", () => {
    const transactions = [
      { id: "credit-full", date: "2026-08-02", item: "Alex PayNow", amount: 100, category: "Others" },
      { id: "credit-partial", date: "2026-08-03", item: "Sam PayNow", amount: 80, category: "Transport" },
    ];
    const claimLinks = [
      { id: "link-1", claim_id: "claim-1", credit_tx_id: "credit-full", allocated_amount: 100 },
      { id: "link-2", claim_id: "claim-2", credit_tx_id: "credit-partial", allocated_amount: 30 },
    ];
    render(<Overview transactions={transactions} categories={[]} claims={[]} claimLinks={claimLinks} onChanged={vi.fn()} reloadClaims={vi.fn()} />);

    const moneyInCard = screen.getByText("Money in").closest(".card");
    expect(screen.queryByText("Others")).not.toBeInTheDocument();
    expect(within(moneyInCard).getByText("Transport")).toBeInTheDocument();
    expect(within(moneyInCard).getByText("+$50.00")).toBeInTheDocument(); // 80 - 30 unclaimed remainder
  });

  it("reduces a claimed debit's Money Out amount by what's actually been received", () => {
    const transactions = [{ id: "debit-1", date: "2026-08-01", item: "Dinner", amount: -100, category: "Food & Drink" }];
    const claims = [{ id: "claim-1", debit_tx_id: "debit-1", expected: 75 }];
    const claimLinks = [{ id: "link-1", claim_id: "claim-1", credit_tx_id: "credit-1", allocated_amount: 30 }];
    render(<Overview transactions={transactions} categories={[]} claims={claims} claimLinks={claimLinks} onChanged={vi.fn()} reloadClaims={vi.fn()} />);

    const moneyOutCard = screen.getByText("Money out").closest(".card");
    // -100 + 30 received so far = -70, not the full -100 or the -25 "fully settled" figure.
    expect(within(moneyOutCard).getByText("−$70.00")).toBeInTheDocument();
  });

  it("shows a Show more/Show less toggle only once a card has more than 4 categories", () => {
    const manyCategories = ["A", "B", "C", "D", "E"].map((name, i) => ({
      id: `t${i}`, date: "2026-08-01", item: name, amount: -(10 - i), category: name,
    }));
    render(<Overview transactions={manyCategories} categories={[]} claims={[]} claimLinks={[]} onChanged={vi.fn()} reloadClaims={vi.fn()} />);

    const moneyOutCard = screen.getByText("Money out").closest(".card");
    expect(catRowsIn(moneyOutCard)).toHaveLength(4);
    expect(within(moneyOutCard).queryByText("E")).not.toBeInTheDocument();

    fireEvent.click(within(moneyOutCard).getByRole("button", { name: /show 1 more/i }));
    expect(catRowsIn(moneyOutCard)).toHaveLength(5);
    expect(within(moneyOutCard).getByText("E")).toBeInTheDocument();

    fireEvent.click(within(moneyOutCard).getByRole("button", { name: /show less/i }));
    expect(catRowsIn(moneyOutCard)).toHaveLength(4);
  });
});
