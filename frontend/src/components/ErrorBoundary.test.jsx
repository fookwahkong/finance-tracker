import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Boom() {
  throw new Error("render crash");
}

describe("ErrorBoundary", () => {
  it("renders fallback UI when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("safe content")).toBeInTheDocument();
  });
});
