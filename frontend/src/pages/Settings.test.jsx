import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const signOut = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ signOut, session: {}, loading: false, signInDemo: vi.fn() }),
}));
vi.mock("../api/client", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import Settings from "./Settings";

describe("Settings", () => {
  it("has a Sign out button that signs the user out", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
