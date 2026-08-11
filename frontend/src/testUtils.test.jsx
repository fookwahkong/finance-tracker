import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithClient } from "./testUtils";

describe("renderWithClient", () => {
  it("renders children inside a QueryClientProvider", () => {
    renderWithClient(<div>ok</div>);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
