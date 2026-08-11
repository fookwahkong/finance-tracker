import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithClient, createTestQueryClient } from "../testUtils";

const signOut = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ signOut, session: {}, loading: false, signInDemo: vi.fn() }),
}));
const getCategories = vi.fn().mockResolvedValue([]);
vi.mock("../api/client", () => ({
  getCategories: (...args) => getCategories(...args),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import Settings from "./Settings";

describe("Settings", () => {
  it("has a Sign out button that signs the user out", async () => {
    renderWithClient(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("reuses cached categories across remounts instead of refetching", async () => {
    getCategories.mockClear();
    const client = createTestQueryClient();
    const { unmount } = renderWithClient(<Settings />, client);
    await screen.findByText(/no categories yet/i);

    unmount();
    renderWithClient(<Settings />, client);
    await screen.findByText(/no categories yet/i);

    expect(getCategories).toHaveBeenCalledTimes(1);
  });
});
