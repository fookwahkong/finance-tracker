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
        participant={{ id: "alex-1", name: "Alex", shareAmount: 60, received: 20 }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog", { name: /assign repayment from alex/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/credit transaction/i)).toHaveValue("credit-1");
    expect(screen.getByLabelText(/amount to assign/i)).toHaveValue(40);

    fireEvent.change(screen.getByLabelText(/amount to assign/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /assign \$30\.00/i }));

    expect(onSubmit).toHaveBeenCalledWith({ credit_tx_id: "credit-1", allocated_amount: 30, participant_id: "alex-1" });
  });

  it("shows the supplied server error and closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <ClaimRepaymentDialog
        credits={credits}
        initialCreditId="credit-1"
        participant={{ id: "alex-1", name: "Alex", shareAmount: 60, received: 20 }}
        serverError="Credit already allocated"
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Credit already allocated");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  const participants = [
    { id: "alex-1", name: "Alex", shareAmount: 60, received: 20 },
    { id: "sam-1", name: "Sam", shareAmount: 30, received: 0 },
  ];

  it("shows a person picker and year/month filters defaulting to the claim's month, with no fixed participant", () => {
    render(
      <ClaimRepaymentDialog
        credits={credits}
        participants={participants}
        claimMonth="2026-08"
        years={[2025, 2026]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /assign repayment from alex/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^person$/i)).toHaveValue("alex-1");
    expect(screen.getByLabelText(/^year$/i)).toHaveValue("2026");
    expect(screen.getByLabelText(/^month$/i)).toHaveValue("08");
  });

  it("recomputes the default credit and amount when the person changes", () => {
    render(
      <ClaimRepaymentDialog
        credits={credits}
        participants={participants}
        claimMonth="2026-08"
        years={[2026]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: "sam-1" } });

    // Sam owes 30 with nothing received yet; the default credit (credit-1, $50 available)
    // covers it fully, so the amount defaults to Sam's full remaining balance.
    expect(screen.getByRole("dialog", { name: /assign repayment from sam/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/amount to assign/i)).toHaveValue(30);
  });

  it("narrows the credit list by year/month and shows an empty state when nothing matches", () => {
    render(
      <ClaimRepaymentDialog
        credits={credits}
        participants={participants}
        claimMonth="2026-08"
        years={[2025, 2026]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^year$/i), { target: { value: "2025" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/no credit transactions found/i);
    expect(screen.queryByLabelText(/credit transaction/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /assign \$/i })).toBeDisabled();
  });

  it("includes the selected participant in the submitted payload", () => {
    const onSubmit = vi.fn();
    render(
      <ClaimRepaymentDialog
        credits={credits}
        participants={participants}
        claimMonth="2026-08"
        years={[2026]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: "sam-1" } });
    fireEvent.click(screen.getByRole("button", { name: /assign \$/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ participant_id: "sam-1" }));
  });
});
