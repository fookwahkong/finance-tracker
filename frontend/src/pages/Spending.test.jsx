import { screen } from "@testing-library/react";
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
});
