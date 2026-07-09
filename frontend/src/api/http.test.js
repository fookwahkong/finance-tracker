import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-1" } } }),
      signOut: vi.fn(),
    },
  },
}));

import http, { normalizeError } from "./http";

describe("normalizeError", () => {
  it("extracts message, status, and request id from an axios error", () => {
    const axiosError = {
      response: {
        status: 500,
        data: { detail: "Internal error", request_id: "abc-123" },
        headers: { "x-request-id": "abc-123" },
      },
      message: "Request failed with status code 500",
    };
    const norm = normalizeError(axiosError);
    expect(norm.status).toBe(500);
    expect(norm.requestId).toBe("abc-123");
    expect(norm.message).toBe("Internal error");
  });

  it("falls back to axios message when no response body", () => {
    const axiosError = { message: "Network Error" };
    const norm = normalizeError(axiosError);
    expect(norm.status).toBe(null);
    expect(norm.requestId).toBe(null);
    expect(norm.message).toBe("Network Error");
  });
});

describe("http auth interceptor", () => {
  it("attaches the bearer token from the session", async () => {
    const config = await http.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer tok-1");
  });
});
