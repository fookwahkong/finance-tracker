import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { loading, session } = useAuth();
  return <div>{loading ? "loading" : session ? "in" : "out"}</div>;
}

describe("AuthProvider", () => {
  it("resolves to signed-out when there is no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });
});
