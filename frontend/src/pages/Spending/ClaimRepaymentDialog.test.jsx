import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClaimRepaymentDialog from "./ClaimRepaymentDialog";

const credits = [
  { id: "credit-1", item: "Alex PayNow", date: "2026-08-03", available: 50 },
  { id: "credit-2", item: "Other credit", date: "2026-08-04", available: 20 },
];

describe("ClaimRepaymentDialog", () => {
  it("prefills the dropped credit and submits the confirmed amount", () => {
    const onSubmit = vi.fn();
    render(
      <ClaimRepaymentDialog
        credits={credits}
        initialCreditId="credit-1"
        participant={{ name: "Alex", shareAmount: 60, received: 20 }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog", { name: /assign repayment from alex/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/credit transaction/i)).toHaveValue("credit-1");
    expect(screen.getByLabelText(/amount to assign/i)).toHaveValue(40);

    fireEvent.change(screen.getByLabelText(/amount to assign/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /assign \$30\.00/i }));

    expect(onSubmit).toHaveBeenCalledWith({ credit_tx_id: "credit-1", allocated_amount: 30 });
  });

  it("shows the supplied server error and closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <ClaimRepaymentDialog
        credits={credits}
        initialCreditId="credit-1"
        participant={{ name: "Alex", shareAmount: 60, received: 20 }}
        serverError="Credit already allocated"
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Credit already allocated");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
