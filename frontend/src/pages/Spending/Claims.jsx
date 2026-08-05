import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { money } from "../../lib/format";
import { allocatedByCredit, linksForClaims, participantBalance, participantsForClaim } from "../../lib/claims";
import { linkCredit, settleClaim, unlinkCredit } from "../../api/claims";
import { useModalFocus } from "../../hooks/useModalFocus";

const cents = (value) => Math.round(Number(value) * 100) / 100;

export default function Claims({ claims, transactions = [], onChanged }) {
  const [assignment, setAssignment] = useState(null);
  const [creditId, setCreditId] = useState("");
  const [amount, setAmount] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const assignmentDialogRef = useRef(null);
  const creditSelectRef = useRef(null);
  const openClaims = claims.filter((claim) => claim.status === "open");
  useModalFocus(
    assignmentDialogRef,
    creditSelectRef,
    () => setAssignment(null),
    { open: Boolean(assignment), blocked: saving },
  );

  const txById = useMemo(
    () => Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );

  const allLinks = useMemo(
    () => linksForClaims(claims),
    [claims],
  );
  const allocatedByTransaction = useMemo(() => allocatedByCredit(allLinks), [allLinks]);
  const availableCredits = useMemo(
    () => transactions
      .filter((transaction) => Number(transaction.amount) > 0)
      .map((transaction) => ({
        ...transaction,
        available: cents(Number(transaction.amount) - (allocatedByTransaction[transaction.id] || 0)),
      }))
      .filter((transaction) => transaction.available > 0),
    [transactions, allocatedByTransaction],
  );

  function suggestedAmount(participant, selectedCreditId) {
    const credit = availableCredits.find((item) => item.id === selectedCreditId);
    if (!credit) return "";
    const balance = participantBalance(participant);
    const targetAmount = balance.remaining > 0 ? balance.remaining : credit.available;
    return cents(Math.min(targetAmount, credit.available)).toFixed(2);
  }

  function openAssignment(claim, participant, preferredCreditId = null) {
    const firstCredit = availableCredits.find((credit) => credit.id === preferredCreditId) || availableCredits[0];
    setAssignment({ claim, participant });
    setCreditId(firstCredit?.id || "");
    setAmount(firstCredit ? suggestedAmount(participant, firstCredit.id) : "");
    setAssignmentError("");
  }

  function dropOnParticipant(event, claim, participant) {
    event.preventDefault();
    const droppedCreditId = event.dataTransfer.getData("text/credit-id");
    if (!availableCredits.some((credit) => credit.id === droppedCreditId)) return;
    openAssignment(claim, participant, droppedCreditId);
  }

  function changeCredit(nextCreditId) {
    setCreditId(nextCreditId);
    setAmount(suggestedAmount(assignment.participant, nextCreditId));
    setAssignmentError("");
  }

  async function submitAssignment(event) {
    event.preventDefault();
    const selectedCredit = availableCredits.find((credit) => credit.id === creditId);
    const allocatedAmount = Number(amount);
    if (!selectedCredit) {
      setAssignmentError("Choose an available credit transaction.");
      return;
    }
    if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
      setAssignmentError("Enter an amount greater than 0.");
      return;
    }
    if (allocatedAmount > selectedCredit.available) {
      setAssignmentError(`Only ${money(selectedCredit.available)} remains available on this credit.`);
      return;
    }

    setSaving(true);
    setAssignmentError("");
    try {
      const data = { credit_tx_id: creditId, allocated_amount: allocatedAmount };
      if (assignment.participant.legacy) {
        await linkCredit(assignment.claim.id, data);
      } else {
        await linkCredit(assignment.claim.id, assignment.participant.id, data);
      }
      setAssignment(null);
      onChanged?.();
    } catch (error) {
      setAssignmentError(error?.response?.data?.detail || "Unable to assign this repayment.");
    } finally {
      setSaving(false);
    }
  }

  async function closeClaim(claim, participants) {
    const shortfalls = participants
      .filter((participant) => !participant.isOwner)
      .map((participant) => ({ name: participant.name, ...participantBalance(participant) }))
      .filter((balance) => balance.remaining > 0.005);
    const message = shortfalls.length
      ? `Close this claim with money still outstanding?\n\n${shortfalls.map((balance) => `${balance.name}: ${money(balance.remaining)}`).join("\n")}`
      : "Close this claim? Everyone is fully accounted for.";
    if (!window.confirm(message)) return;

    setActionError("");
    try {
      await settleClaim(claim.id);
      onChanged?.();
    } catch (error) {
      setActionError(error?.response?.data?.detail || "Unable to close this claim.");
    }
  }

  async function removeAllocation(claimId, linkId) {
    setActionError("");
    try {
      await unlinkCredit(claimId, linkId);
      onChanged?.();
    } catch (error) {
      setActionError(error?.response?.data?.detail || "Unable to unlink this repayment.");
    }
  }

  if (openClaims.length === 0) {
    return (
      <section className="card claims-empty">
        <div className="empty">
          <strong>No open claims</strong>
          <span>Shared expenses will appear here until everyone has paid you back.</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="claims-page-head">
        <div>
          <div className="eyebrow">Shared expenses</div>
          <h1>Claims</h1>
          <p>See exactly who owes what and attach each repayment to the right person.</p>
        </div>
        <span className="pill">{openClaims.length} open</span>
      </div>

      {actionError && <div className="form-error" role="alert">{actionError}</div>}

      {availableCredits.length > 0 && (
        <section className="claim-credit-tray" aria-labelledby="available-repayments-title">
          <div>
            <strong id="available-repayments-title">Available repayments</strong>
            <span>Drag a credit onto the person who paid you, or use Assign repayment.</span>
          </div>
          <div className="claim-credit-list" role="list">
            {availableCredits.map((credit) => (
              <div
                className="claim-credit-item"
                role="listitem"
                aria-label={`Drag ${credit.item} repayment`}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/credit-id", credit.id)}
                key={credit.id}
              >
                <span aria-hidden="true">↕</span>
                <div>
                  <strong>{credit.item}</strong>
                  <span>{credit.date || "Credit transaction"}</span>
                </div>
                <strong>{money(credit.available)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="claims-list">
        {openClaims.map((claim) => {
          const transaction = txById[claim.debit_tx_id];
          const participants = participantsForClaim(claim);
          const owner = participants.find((participant) => participant.isOwner);
          const people = participants.filter((participant) => !participant.isOwner);
          const balances = people.map((participant) => participantBalance(participant));
          const expected = balances.reduce((sum, balance) => sum + balance.owed, 0);
          const received = balances.reduce((sum, balance) => sum + balance.received, 0);
          const remaining = cents(expected - received);

          return (
            <section className="claim-card" key={claim.id}>
              <div className="claim-card-head">
                <div>
                  <div className="claim-card-kicker">{transaction?.date || "Shared expense"}</div>
                  <h2>{transaction?.item || claim.category || "Shared expense"}</h2>
                  <div className="claim-card-sub">Paid {money(claim.total)} · {people.length} {people.length === 1 ? "person" : "people"} sharing with you</div>
                </div>
                <button type="button" className="btn btn-outline" onClick={() => closeClaim(claim, participants)}>Close claim</button>
              </div>

              <div className="claim-summary" aria-label="Claim summary">
                <div><span>Total paid</span><strong>{money(claim.total)}</strong></div>
                <div><span>Your share</span><strong>{money(owner?.shareAmount || 0)}</strong></div>
                <div><span>Received</span><strong className="pos">{money(received)}</strong></div>
                <div><span>{remaining < 0 ? "Overpaid" : "Still owed"}</span><strong className={remaining > 0 ? "neg" : "pos"}>{money(remaining)}</strong></div>
              </div>

              <div className="claim-people">
                {people.map((participant) => {
                  const balance = participantBalance(participant);
                  const percentage = Number(participant.sharePercent || 0).toFixed(2);
                  return (
                    <article
                      className="claim-person"
                      aria-label={`${participant.name} repayment`}
                      key={participant.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropOnParticipant(event, claim, participant)}
                    >
                      <div className="claim-person-head">
                        <div className="split-avatar" aria-hidden="true">{participant.name.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <h3>{participant.name}</h3>
                          <span>{percentage}% of this expense</span>
                        </div>
                        {participant.legacy && <span className="claim-legacy-tag">Legacy claim</span>}
                        <button type="button" className="btn btn-primary" onClick={() => openAssignment(claim, participant)}>Assign repayment</button>
                      </div>

                      <div className="claim-person-progress" role="progressbar" aria-label={`${participant.name} repayment progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(balance.progress * 100)}>
                        <span style={{ width: `${balance.progress * 100}%` }} />
                      </div>

                      <div className="claim-person-metrics">
                        <div><span>Owed</span><strong>{money(balance.owed)}</strong></div>
                        <div><span>Received</span><strong>{money(balance.received)}</strong></div>
                        {balance.overpaid > 0 ? (
                          <div className="is-overpaid"><span>Overpaid</span><strong>{money(balance.overpaid)}</strong></div>
                        ) : (
                          <div><span>Remaining</span><strong>{money(balance.remaining)}</strong></div>
                        )}
                      </div>

                      {participant.legacy && <p className="claim-legacy-note">Upgrade the backend participant model to split this combined balance by person.</p>}

                      {(participant.links || []).length > 0 && (
                        <div className="claim-repayments" aria-label={`${participant.name} linked repayments`}>
                          {participant.links.map((link) => (
                            <div className="claim-repayment" key={link.id}>
                              <div>
                                <strong>{txById[link.credit_tx_id]?.item || "Linked credit"}</strong>
                                <span>{txById[link.credit_tx_id]?.date || ""}</span>
                              </div>
                              <strong>{money(link.allocated_amount)}</strong>
                              <button type="button" className="btn btn-ghost" onClick={() => removeAllocation(claim.id, link.id)}>Unlink</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {assignment && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setAssignment(null)}>
          <div ref={assignmentDialogRef} className="modal-panel repayment-modal" role="dialog" aria-modal="true" aria-labelledby="repayment-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title" id="repayment-dialog-title">Assign repayment from {assignment.participant.name}</div>
                <div className="modal-sub">Choose the bank credit that belongs to this person.</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close repayment dialog" onClick={() => setAssignment(null)} disabled={saving}>×</button>
            </div>
            <form onSubmit={submitAssignment}>
              {assignment.participant.legacy && <div className="claim-legacy-note">This uses the current aggregate endpoint until the participant backend is added.</div>}
              {assignmentError && <div className="form-error" role="alert">{assignmentError}</div>}
              {availableCredits.length === 0 ? (
                <div className="empty">No unassigned credit transactions are available.</div>
              ) : (
                <div className="form-grid modal-form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="repayment-credit">Credit transaction</label>
                    <select ref={creditSelectRef} id="repayment-credit" className="select" value={creditId} onChange={(event) => changeCredit(event.target.value)}>
                      {availableCredits.map((credit) => (
                        <option value={credit.id} key={credit.id}>{credit.item} · {money(credit.available)} available</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="repayment-amount">Amount to assign</label>
                    <input id="repayment-amount" className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setAssignment(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || availableCredits.length === 0 || !(Number(amount) > 0)}>
                  {saving ? "Assigning..." : `Assign ${money(Number(amount) || 0)}`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
