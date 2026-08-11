import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getBudgets = vi.fn().mockResolvedValue([]);
const getTransactions = vi.fn().mockResolvedValue([]);
vi.mock("../api/client", () => ({
  getBudgets: (...args) => getBudgets(...args),
  getTransactions: (...args) => getTransactions(...args),
  upsertBudget: vi.fn(),
}));

import Budget from "./Budget";

describe("Budget", () => {
  it("reuses cached budgets and transactions across remounts", async () => {
    getBudgets.mockClear();
    getTransactions.mockClear();
    const client = createTestQueryClient();
    const { unmount } = renderWithClient(<Budget />, client);
    await screen.findByText(/budget by category/i);

    unmount();
    renderWithClient(<Budget />, client);
    await screen.findByText(/budget by category/i);

    expect(getBudgets).toHaveBeenCalledTimes(1);
    expect(getTransactions).toHaveBeenCalledTimes(1);
  });
});
