import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getMonthlyReport = vi.fn().mockResolvedValue({
  breakdown: { Food: -50 },
  total_income: 1000,
  total_expenses: 50,
  net: 950,
});
vi.mock("../api/client", () => ({
  getMonthlyReport: (...args) => getMonthlyReport(...args),
}));

import Report from "./Report";

describe("Report", () => {
  it("reuses the cached monthly report across remounts for the same month", async () => {
    getMonthlyReport.mockClear();
    const client = createTestQueryClient();
    const { unmount } = renderWithClient(<Report />, client);
    await screen.findByText(/monthly report/i);

    unmount();
    renderWithClient(<Report />, client);
    await screen.findByText(/monthly report/i);

    expect(getMonthlyReport).toHaveBeenCalledTimes(1);
  });
});
