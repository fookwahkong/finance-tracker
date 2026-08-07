import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermInfo from "./TermInfo";

describe("TermInfo", () => {
  it("renders an unknown label as plain text, with no control", () => {
    render(<TermInfo label="Date" />);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when the label is missing", () => {
    const { container } = render(<TermInfo label={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a dialog with the meaning and implication, and closes again", () => {
    render(<TermInfo label="Free cash flow" />);

    fireEvent.click(screen.getByRole("button", { name: "Free cash flow" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Free cash flow");
    expect(dialog).toHaveTextContent("Operating cash flow minus capital expenditure");
    expect(dialog).toHaveTextContent("What it tells you");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<TermInfo label="Mkt. cap" />);

    fireEvent.click(screen.getByRole("button", { name: "Mkt. cap" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
