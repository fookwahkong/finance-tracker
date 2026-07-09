import { describe, it, expect } from "vitest";
import { normalizeError } from "./http";

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
