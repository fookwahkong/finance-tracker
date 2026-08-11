import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const getCategories = vi.fn().mockResolvedValue([{ id: "c1", name: "Food" }]);
vi.mock("../api/client", () => ({
  getCategories: (...args) => getCategories(...args),
  parseStatement: vi.fn(),
  importStatement: vi.fn(),
}));

import Import from "./Import";

describe("Import", () => {
  it("reuses cached categories across remounts instead of refetching", async () => {
    getCategories.mockClear();
    const client = createTestQueryClient();
    const { unmount } = renderWithClient(<Import />, client);
    await screen.findByText(/import statement/i);

    unmount();
    renderWithClient(<Import />, client);
    await screen.findByText(/import statement/i);

    expect(getCategories).toHaveBeenCalledTimes(1);
  });
});
