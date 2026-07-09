import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const signInDemo = vi.fn().mockResolvedValue({ error: null });
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ signInDemo, session: null, loading: false, signOut: vi.fn() }),
}));

import Login from "./Login";

describe("Login", () => {
  it("has a Try the demo button that signs into the demo account", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /try the demo/i }));
    expect(signInDemo).toHaveBeenCalled();
  });
});
