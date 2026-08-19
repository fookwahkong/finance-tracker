import { fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getTransactions = vi.fn().mockResolvedValue([]);
const getCategories = vi.fn().mockResolvedValue([]);
vi.mock("../api/client", () => ({
  getTransactions: (...args) => getTransactions(...args),
  getCategories: (...args) => getCategories(...args),
}));
const getClaims = vi.fn().mockResolvedValue([]);
vi.mock("../api/claims", () => ({ getClaims: (...args) => getClaims(...args) }));

import Spending from "./Spending";

describe("Spending", () => {
  it("reuses cached transactions, claims, and categories across remounts", async () => {
    getTransactions.mockClear();
    getCategories.mockClear();
    getClaims.mockClear();
    const client = createTestQueryClient();
    const { unmount } = renderWithClient(<Spending />, client);
    await screen.findByText(/no transactions in this month/i);

    unmount();
    renderWithClient(<Spending />, client);
    await screen.findByText(/no transactions in this month/i);

    expect(getTransactions).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("still filters by the month picked in the selector after the period refactor", async () => {
    // Anchored to the real current month rather than a fake clock, so the
    // test stays true whenever it runs. Overview defaults to this month; the
    // selector switches it to another one in the same year.
    const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const year = now.getFullYear();
    const thisMonth = String(now.getMonth() + 1).padStart(2, "0");
    const otherIndex = now.getMonth() === 0 ? 1 : 0;
    const otherMonth = String(otherIndex + 1).padStart(2, "0");

    getTransactions.mockResolvedValueOnce([
      { id: "t1", date: `${year}-${thisMonth}-04`, item: "This month lunch", amount: -12, category: "Food & Drink" },
      { id: "t2", date: `${year}-${otherMonth}-04`, item: "Other month lunch", amount: -18, category: "Food & Drink" },
    ]);

    renderWithClient(<Spending />, createTestQueryClient());
    expect(await screen.findByText("This month lunch")).toBeInTheDocument();
    expect(screen.queryByText("Other month lunch")).not.toBeInTheDocument();

    // The month buttons moved out of Overview into Spending, but still drive
    // which period Overview renders.
    fireEvent.click(screen.getByRole("button", { name: MONTH_ABBR[otherIndex] }));
    expect(await screen.findByText("Other month lunch")).toBeInTheDocument();
    expect(screen.queryByText("This month lunch")).not.toBeInTheDocument();
  });
});
