import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClaimSplitDialog from "./ClaimSplitDialog";

const transaction = { id: "tx-1", item: "Dinner", amount: -100 };

function addPerson(name) {
  fireEvent.change(screen.getByLabelText(/person's name/i), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: /add person/i }));
}

describe("ClaimSplitDialog", () => {
  it("recalculates an equal split as people are added", () => {
    render(<ClaimSplitDialog transaction={transaction} onClose={vi.fn()} onSubmit={vi.fn()} />);

    addPerson("Alex");
    addPerson("Sam");

    const rows = screen.getAllByTestId("split-participant");
    expect(within(rows[0]).getByText("33.33%")).toBeInTheDocument();
    expect(within(rows[0]).getByText("$33.34")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Alex")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$33.33")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("$66.66")).toBeInTheDocument();
  });

  it("lets the user override their share and reset to equal", () => {
    render(<ClaimSplitDialog transaction={transaction} onClose={vi.fn()} onSubmit={vi.fn()} />);
    addPerson("Alex");
    addPerson("Sam");

    fireEvent.click(screen.getByRole("button", { name: /set custom share/i }));
    fireEvent.change(screen.getByLabelText(/your share percentage/i), { target: { value: "40" } });

    expect(screen.getByText("40.00%")).toBeInTheDocument();
    expect(screen.getAllByText("30.00%")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /remove sam/i }));
    expect(screen.getByText("60.00%")).toBeInTheDocument();
    expect(screen.getAllByText("$60.00")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /reset to equal split/i }));
    expect(screen.getAllByText("50.00%")).toHaveLength(2);
  });

  it("submits participant names and exact calculated shares", () => {
    const onSubmit = vi.fn();
    render(<ClaimSplitDialog transaction={transaction} onClose={vi.fn()} onSubmit={onSubmit} />);
    addPerson("Alex");
    addPerson("Sam");

    fireEvent.click(screen.getByRole("button", { name: /save shared expense/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      mode: "equal",
      ownerAmount: 33.34,
      expectedAmount: 66.66,
      namedParticipants: [
        expect.objectContaining({ name: "Alex", amount: 33.33 }),
        expect.objectContaining({ name: "Sam", amount: 33.33 }),
      ],
    }));
  });

  it("treats an empty custom percentage as invalid instead of zero", () => {
    render(<ClaimSplitDialog transaction={transaction} onClose={vi.fn()} onSubmit={vi.fn()} />);
    addPerson("Alex");
    fireEvent.click(screen.getByRole("button", { name: /set custom share/i }));
    fireEvent.change(screen.getByLabelText(/your share percentage/i), { target: { value: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/valid percentage/i);
    expect(screen.getByRole("button", { name: /save shared expense/i })).toBeDisabled();
  });
});
