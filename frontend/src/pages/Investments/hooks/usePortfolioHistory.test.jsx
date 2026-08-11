import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../testUtils";

const getInvestTransactions = vi.fn().mockResolvedValue([]);
const getAggregates = vi.fn();
vi.mock("../../../api/investments", () => ({
  getInvestTransactions: (...args) => getInvestTransactions(...args),
  getAggregates: (...args) => getAggregates(...args),
}));

import { usePortfolioHistory } from "./usePortfolioHistory";

describe("usePortfolioHistory", () => {
  it("shares the invest-transactions cache across remounts", async () => {
    getInvestTransactions.mockClear();
    const client = createTestQueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => usePortfolioHistory(120), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(() => usePortfolioHistory(120), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(getInvestTransactions).toHaveBeenCalledTimes(1);
  });
});
