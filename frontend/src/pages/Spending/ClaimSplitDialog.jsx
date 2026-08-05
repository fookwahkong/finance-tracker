import { useMemo, useRef, useState } from "react";
import { money } from "../../lib/format";
import { calculateClaimSplit, participantNameKey } from "../../lib/claims";
import { useModalFocus } from "../../hooks/useModalFocus";

export default function ClaimSplitDialog({ transaction, saving = false, serverError = "", onClose, onSubmit }) {
  const [names, setNames] = useState([]);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customPercent, setCustomPercent] = useState("");
  const dialogRef = useRef(null);
  const nameInputRef = useRef(null);
  const total = Math.abs(Number(transaction.amount || 0));
  useModalFocus(dialogRef, nameInputRef, onClose, { blocked: saving });

  const split = useMemo(
    () => calculateClaimSplit(
      total,
      names,
      customMode ? (customPercent.trim() === "" ? Number.NaN : Number(customPercent)) : null,
    ),
    [total, names, customMode, customPercent],
  );

  function addPerson() {
    const cleanName = draftName.trim();
    if (!cleanName) {
      setNameError("Enter a name before adding this person.");
      return;
    }
    if (participantNameKey(cleanName) === participantNameKey("You")) {
      setNameError('"You" is already included as the payer.');
      return;
    }
    if (names.some((name) => participantNameKey(name) === participantNameKey(cleanName))) {
      setNameError("Each participant name must be unique.");
      return;
    }
    setNames((current) => [...current, cleanName]);
    setDraftName("");
    setNameError("");
  }

  function removePerson(index) {
    setNames((current) => current.filter((_, personIndex) => personIndex !== index));
    setNameError("");
  }

  function enableCustomMode() {
    setCustomPercent(split.ownerPercent.toFixed(2));
    setCustomMode(true);
  }

  function resetEqualSplit() {
    setCustomMode(false);
    setCustomPercent("");
  }

  function submit(event) {
    event.preventDefault();
    if (!split.valid || saving) return;
    onSubmit(split);
  }

  const splitErrors = Object.values(split.errors);

  return (
    <div ref={dialogRef} className="modal-panel claim-split-modal" role="dialog" aria-modal="true" aria-labelledby="claim-split-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <div>
          <div className="modal-title" id="claim-split-title">Split this expense</div>
          <div className="modal-sub">{transaction.item} · Total paid {money(total)}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Close shared expense" onClick={onClose} disabled={saving}>×</button>
      </div>

      <form onSubmit={submit}>
        {serverError && <div className="form-error" role="alert">{serverError}</div>}

        <div className="split-toolbar">
          <div>
            <div className="field-label">How should this be split?</div>
            <div className="split-mode-copy">{customMode ? "Your custom share; everyone else splits the remainder." : "Equally between You and everyone added."}</div>
          </div>
          {customMode ? (
            <button type="button" className="btn btn-ghost" onClick={resetEqualSplit}>Reset to equal split</button>
          ) : (
            <button type="button" className="btn btn-outline" onClick={enableCustomMode}>Set custom share</button>
          )}
        </div>

        {customMode && (
          <div className="field split-percent-field">
            <label className="field-label" htmlFor="claim-owner-percent">Your share percentage</label>
            <div className="input-suffix-wrap">
              <input
                id="claim-owner-percent"
                className="input"
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                value={customPercent}
                onChange={(event) => setCustomPercent(event.target.value)}
              />
              <span>%</span>
            </div>
            {split.errors.ownerPercent && <div className="field-error" role="alert">{split.errors.ownerPercent}</div>}
          </div>
        )}

        <div className="split-participants" aria-label="Expense participants">
          {split.participants.map((participant, index) => (
            <div className={`split-participant${participant.isOwner ? " is-owner" : ""}`} data-testid="split-participant" key={participant.id}>
              <div className="split-avatar" aria-hidden="true">{participant.isOwner ? "Y" : participant.name.slice(0, 1).toUpperCase()}</div>
              <div className="split-person-name">
                <strong>{participant.name || "Unnamed person"}</strong>
                {participant.isOwner && <span className="split-owner-tag">Payer</span>}
              </div>
              <div className="split-person-percent">{participant.percent.toFixed(2)}%</div>
              <div className="split-person-amount">{money(participant.amount)}</div>
              {!participant.isOwner && (
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${participant.name}`} onClick={() => removePerson(index - 1)}>×</button>
              )}
            </div>
          ))}
        </div>

        <div className="split-add-person">
          <div className="field">
            <label className="field-label" htmlFor="claim-person-name">Person&apos;s name</label>
            <input
              ref={nameInputRef}
              id="claim-person-name"
              className="input"
              type="text"
              placeholder="e.g. Alex"
              value={draftName}
              onChange={(event) => { setDraftName(event.target.value); setNameError(""); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addPerson();
                }
              }}
            />
          </div>
          <button type="button" className="btn btn-outline" onClick={addPerson}>Add person</button>
        </div>
        {nameError && <div className="field-error" role="alert">{nameError}</div>}

        <div className="split-summary" aria-label="Split summary">
          <div><span>Your spending</span><strong>{money(split.ownerAmount)}</strong></div>
          <div><span>Expected back</span><strong>{money(split.expectedAmount)}</strong></div>
        </div>

        {!nameError && splitErrors.filter((message) => message !== split.errors.ownerPercent).map((message) => (
          <div className="field-error" role="alert" key={message}>{message}</div>
        ))}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!split.valid || saving}>
            {saving ? "Saving split..." : "Save shared expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
