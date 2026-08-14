import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getMonthlyReport = vi.fn().mockResolvedValue({ breakdown: {} });
const getTransactions = vi.fn().mockResolvedValue([]);
const getBudgets = vi.fn().mockResolvedValue([]);
vi.mock("../api/client", () => ({
  getMonthlyReport: (...args) => getMonthlyReport(...args),
  getTransactions: (...args) => getTransactions(...args),
  getBudgets: (...args) => getBudgets(...args),
  getNetWorth: vi.fn().mockResolvedValue([]),
  getSubscriptions: vi.fn().mockResolvedValue([]),
  getSavings: vi.fn().mockResolvedValue({ goals: [], contributions: [] }),
  getFxRate: vi.fn().mockResolvedValue({ rate: 1.34, date: "2026-07-01" }),
}));
vi.mock("./Investments/hooks/usePortfolioValue", () => ({
  usePortfolioValue: () => ({ valueUsd: null, totals: null, loading: false }),
}));
vi.mock("./Investments/hooks/usePortfolioHistory", () => ({
  usePortfolioHistory: () => ({ series: [], loading: false }),
}));

import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("reuses cached report, budgets, and transactions across remounts", async () => {
    getMonthlyReport.mockClear();
    getTransactions.mockClear();
    getBudgets.mockClear();
    const client = createTestQueryClient();
    const wrap = (ui) => <MemoryRouter>{ui}</MemoryRouter>;
    const { unmount } = renderWithClient(wrap(<Dashboard />), client);
    await screen.findByText(/net spending/i);

    unmount();
    renderWithClient(wrap(<Dashboard />), client);
    await screen.findByText(/net spending/i);

    expect(getMonthlyReport).toHaveBeenCalledTimes(1);
    expect(getBudgets).toHaveBeenCalledTimes(1);
    // getTransactions is called with two distinct args (month, and no-arg) — each
    // distinct query key should still only fire once across the two mounts.
    expect(getTransactions).toHaveBeenCalledTimes(2);
  });
});
