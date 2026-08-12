import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { money, monthLabel } from "../../lib/format";
import { useModalFocus } from "../../hooks/useModalFocus";

const cents = (value) => Math.round(Number(value) * 100) / 100;

const MONTHS = [
  { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
  { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" },
  { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
  { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

function filterCredits(credits, year, month) {
  if (!year && !month) return credits;
  return credits.filter((credit) => {
    const date = String(credit.date || "");
    return (!year || date.slice(0, 4) === year) && (!month || date.slice(5, 7) === month);
  });
}

export default function ClaimRepaymentDialog({
  credits,
  initialCreditId,
  participant,
  participants,
  claimMonth,
  years = [],
  saving = false,
  serverError = "",
  onClose,
  onSubmit,
}) {
  const showPicker = Array.isArray(participants) && participants.length > 0;
  const [selectedParticipantId, setSelectedParticipantId] = useState(participant?.id || participants?.[0]?.id);
  const effectiveParticipant = showPicker
    ? participants.find((person) => person.id === selectedParticipantId) || participants[0]
    : participant;

  const [filterYear, setFilterYear] = useState(showPicker ? claimMonth?.slice(0, 4) || "" : "");
  const [filterMonth, setFilterMonth] = useState(showPicker ? claimMonth?.slice(5, 7) || "" : "");
  const filteredCredits = showPicker ? filterCredits(credits, filterYear, filterMonth) : credits;

  const remainingFor = (person) => Math.max(0, Number(person.shareAmount || 0) - Number(person.received || 0));

  const firstCredit = filteredCredits.find((credit) => credit.id === initialCreditId) || filteredCredits[0];
  const [creditId, setCreditId] = useState(firstCredit?.id || "");
  const [amount, setAmount] = useState(() => (
    firstCredit ? cents(Math.min(firstCredit.available, remainingFor(effectiveParticipant))).toFixed(2) : ""
  ));
  const [validationError, setValidationError] = useState("");
  const dialogRef = useRef(null);
  const creditRef = useRef(null);
  useModalFocus(dialogRef, creditRef, onClose, { blocked: saving });

  function applyDefaults(person, nextCredits) {
    const credit = nextCredits[0];
    setCreditId(credit?.id || "");
    setAmount(credit ? cents(Math.min(credit.available, remainingFor(person))).toFixed(2) : "");
    setValidationError("");
  }

  function changeParticipant(nextId) {
    const person = participants.find((p) => p.id === nextId);
    setSelectedParticipantId(nextId);
    if (person) applyDefaults(person, filterCredits(credits, filterYear, filterMonth));
  }

  function changeYear(nextYear) {
    setFilterYear(nextYear);
    applyDefaults(effectiveParticipant, filterCredits(credits, nextYear, filterMonth));
  }

  function changeMonth(nextMonth) {
    setFilterMonth(nextMonth);
    applyDefaults(effectiveParticipant, filterCredits(credits, filterYear, nextMonth));
  }

  function changeCredit(nextCreditId) {
    const credit = filteredCredits.find((item) => item.id === nextCreditId);
    setCreditId(nextCreditId);
    setAmount(credit ? cents(Math.min(credit.available, remainingFor(effectiveParticipant))).toFixed(2) : "");
    setValidationError("");
  }

  function submit(event) {
    event.preventDefault();
    const selectedCredit = filteredCredits.find((credit) => credit.id === creditId);
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
    onSubmit({ credit_tx_id: creditId, allocated_amount: allocatedAmount, participant_id: effectiveParticipant.id });
  }

  const filterLabel = filterYear && filterMonth
    ? monthLabel(`${filterYear}-${filterMonth}`)
    : "the selected period";

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div ref={dialogRef} className="modal-panel repayment-modal" role="dialog" aria-modal="true" aria-labelledby="repayment-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title" id="repayment-dialog-title">Assign repayment from {effectiveParticipant.name}</div>
            <div className="modal-sub">Confirm which bank credit belongs to this person.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close repayment dialog" onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={submit}>
          {(serverError || validationError) && <div className="form-error" role="alert">{serverError || validationError}</div>}
          <div className="form-grid modal-form-grid">
            {showPicker && (
              <div className="field">
                <label className="field-label" htmlFor="repayment-participant">Person</label>
                <select id="repayment-participant" className="select" value={selectedParticipantId} onChange={(event) => changeParticipant(event.target.value)}>
                  {participants.map((person) => (
                    <option value={person.id} key={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
            )}
            {showPicker && (
              <div className="field">
                <label className="field-label" htmlFor="repayment-year">Year</label>
                <select id="repayment-year" className="select" value={filterYear} onChange={(event) => changeYear(event.target.value)}>
                  {years.map((y) => <option value={String(y)} key={y}>{y}</option>)}
                </select>
              </div>
            )}
            {showPicker && (
              <div className="field">
                <label className="field-label" htmlFor="repayment-month">Month</label>
                <select id="repayment-month" className="select" value={filterMonth} onChange={(event) => changeMonth(event.target.value)}>
                  {MONTHS.map((m) => <option value={m.value} key={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}
            {filteredCredits.length === 0 ? (
              <div className="field-error" role="alert">No credit transactions found for {filterLabel}.</div>
            ) : (
              <div className="field">
                <label className="field-label" htmlFor="repayment-credit">Credit transaction</label>
                <select ref={creditRef} id="repayment-credit" className="select" value={creditId} onChange={(event) => changeCredit(event.target.value)}>
                  {filteredCredits.map((credit) => (
                    <option value={credit.id} key={credit.id}>{credit.item} · {money(credit.available)} available</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="repayment-amount">Amount to assign</label>
              <input id="repayment-amount" className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setValidationError(""); }} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || filteredCredits.length === 0 || !(Number(amount) > 0)}>
              {saving ? "Assigning..." : `Assign ${money(Number(amount) || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
