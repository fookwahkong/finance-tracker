import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithClient, createTestQueryClient } from "../../testUtils";

const getInvestTransactions = vi.fn().mockResolvedValue([]);
vi.mock("../../api/investments", () => ({
  getInvestTransactions: (...args) => getInvestTransactions(...args),
  deleteInvestTransaction: vi.fn(),
  createInvestTransaction: vi.fn(),
  updateInvestTransaction: vi.fn(),
  getQuote: vi.fn(),
}));

import Investments from "./index";

describe("Investments", () => {
  it("reuses cached invest transactions across remounts", async () => {
    getInvestTransactions.mockClear();
    const client = createTestQueryClient();
    const wrap = (ui) => <MemoryRouter>{ui}</MemoryRouter>;
    const { unmount } = renderWithClient(wrap(<Investments />), client);
    await screen.findByText(/no trades yet/i);

    unmount();
    renderWithClient(wrap(<Investments />), client);
    await screen.findByText(/no trades yet/i);

    expect(getInvestTransactions).toHaveBeenCalledTimes(1);
  });
});
