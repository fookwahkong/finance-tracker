import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { money } from "../../lib/format";
import { useModalFocus } from "../../hooks/useModalFocus";

const cents = (value) => Math.round(Number(value) * 100) / 100;

export default function ClaimRepaymentDialog({
  credits,
  initialCreditId,
  participant,
  saving = false,
  serverError = "",
  onClose,
  onSubmit,
}) {
  const firstCredit = credits.find((credit) => credit.id === initialCreditId) || credits[0];
  const remaining = Math.max(0, Number(participant.shareAmount || 0) - Number(participant.received || 0));
  const [creditId, setCreditId] = useState(firstCredit?.id || "");
  const [amount, setAmount] = useState(() => (
    firstCredit ? cents(Math.min(firstCredit.available, remaining)).toFixed(2) : ""
  ));
  const [validationError, setValidationError] = useState("");
  const dialogRef = useRef(null);
  const creditRef = useRef(null);
  useModalFocus(dialogRef, creditRef, onClose, { blocked: saving });

  function changeCredit(nextCreditId) {
    const credit = credits.find((item) => item.id === nextCreditId);
    setCreditId(nextCreditId);
    setAmount(credit ? cents(Math.min(credit.available, remaining)).toFixed(2) : "");
    setValidationError("");
  }

  function submit(event) {
    event.preventDefault();
    const selectedCredit = credits.find((credit) => credit.id === creditId);
    const allocatedAmount = Number(amount);
    if (!selectedCredit) {
      setValidationError("Choose an available credit transaction.");
      return;
    }
    if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
      setValidationError("Enter an amount greater than 0.");
      return;
    }
    if (allocatedAmount > selectedCredit.available) {
      setValidationError(`Only ${money(selectedCredit.available)} remains available on this credit.`);
      return;
    }
    onSubmit({ credit_tx_id: creditId, allocated_amount: allocatedAmount });
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div ref={dialogRef} className="modal-panel repayment-modal" role="dialog" aria-modal="true" aria-labelledby="repayment-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title" id="repayment-dialog-title">Assign repayment from {participant.name}</div>
            <div className="modal-sub">Confirm which bank credit belongs to this person.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close repayment dialog" onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={submit}>
          {(serverError || validationError) && <div className="form-error" role="alert">{serverError || validationError}</div>}
          <div className="form-grid modal-form-grid">
            <div className="field">
              <label className="field-label" htmlFor="repayment-credit">Credit transaction</label>
              <select ref={creditRef} id="repayment-credit" className="select" value={creditId} onChange={(event) => changeCredit(event.target.value)}>
                {credits.map((credit) => (
                  <option value={credit.id} key={credit.id}>{credit.item} · {money(credit.available)} available</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="repayment-amount">Amount to assign</label>
              <input id="repayment-amount" className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setValidationError(""); }} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || credits.length === 0 || !(Number(amount) > 0)}>
              {saving ? "Assigning..." : `Assign ${money(Number(amount) || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
