import { useMemo } from "react";
import { money } from "../../lib/format";
import { participantBalance, participantsForClaim } from "../../lib/claims";

const cents = (value) => Math.round(Number(value) * 100) / 100;

export default function Claims({ claims, transactions = [] }) {
  const openClaims = claims.filter((claim) => claim.status === "open");
  const txById = useMemo(
    () => Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );

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
          <p>A read-only summary of what each person still owes.</p>
        </div>
        <span className="pill">{openClaims.length} open</span>
      </div>

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
                    <article className="claim-person" aria-label={`${participant.name} repayment`} key={participant.id}>
                      <div className="claim-person-head">
                        <div className="split-avatar" aria-hidden="true">{participant.name.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <h3>{participant.name}</h3>
                          <span>{percentage}% of this expense</span>
                        </div>
                      </div>
                      <div className="claim-person-progress" role="progressbar" aria-label={`${participant.name} repayment progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(balance.progress * 100)}>
                        <span style={{ width: `${balance.progress * 100}%` }} />
                      </div>
                      <div className="claim-person-metrics">
                        <div><span>Owed</span><strong>{money(balance.owed)}</strong></div>
                        <div><span>Received</span><strong>{money(balance.received)}</strong></div>
                        {balance.overpaid > 0
                          ? <div className="is-overpaid"><span>Overpaid</span><strong>{money(balance.overpaid)}</strong></div>
                          : <div><span>Remaining</span><strong>{money(balance.remaining)}</strong></div>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
