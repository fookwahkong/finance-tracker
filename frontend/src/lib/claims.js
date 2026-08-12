// Pure mirror of core/claims.py. A settled claim's effect reduces to
// subtracting min(received, expected) from both its category's spending and
// from income, in the debit's month. See lib/aggregate.js for application.

export { calculateClaimSplit, participantsForClaim, participantBalance, claimCreatePayload, linksForClaims, participantNameKey } from "./claimSplits";

export function receivedTotal(links) {
  return links.reduce((sum, l) => sum + Number(l.allocated_amount), 0);
}

export function remaining(expected, links) {
  return Number(expected) - receivedTotal(links);
}

export function variance(received, expected) {
  // use for calculating the shortfall/extra of received credits
  return received - expected;
}

export function linksByClaim(links) {
  const out = {};
  for (const l of links) {
    (out[l.claim_id] ||= []).push(l);
  }
  return out;
}

export function allocatedByCredit(links) {
  const out = {};
  for (const l of links) {
    out[l.credit_tx_id] = (out[l.credit_tx_id] || 0) + Number(l.allocated_amount);
  }
  return out;
}

// Returns transactions with claim-reimbursed amounts baked in: a claimed
// debit's magnitude shrinks by what's been received against it; a credit
// already allocated to a claim shrinks by however much of it is claimed.
// This is the one place claim math touches transaction amounts — every
// spend/income total elsewhere (Overview, Month vs Month, Insights) sums
// this list instead of raw transactions, so they can't disagree with it
// or each other.
export function applyClaimAdjustments(transactions, claims, links) {
  const claimByDebit = Object.fromEntries(claims.map((c) => [c.debit_tx_id, c]));
  const grouped = linksByClaim(links);
  const receivedByClaim = Object.fromEntries(
    claims.map((c) => [c.id, receivedTotal(grouped[c.id] || [])]),
  );
  const allocatedByCreditTx = allocatedByCredit(links);

  return transactions.map((t) => {
    const claim = claimByDebit[t.id];
    if (claim) {
      const adjustment = Math.min(receivedByClaim[claim.id] || 0, Number(claim.expected));
      return { ...t, amount: Number(t.amount) + adjustment };
    }
    const allocated = allocatedByCreditTx[t.id];
    if (allocated) {
      return { ...t, amount: Math.max(0, Number(t.amount) - allocated) };
    }
    return t;
  });
}

// One adjustment per settled claim, dated in the debit's month.
export function claimAdjustments(transactions, claims, links) {
  const txById = Object.fromEntries(transactions.map((t) => [t.id, t]));
  const grouped = linksByClaim(links);
  const out = [];
  for (const claim of claims) {
    const debit = txById[claim.debit_tx_id];
    if (!debit) continue;
    const received = receivedTotal(grouped[claim.id] || []);
    const amount = Math.min(received, Number(claim.expected));
    if (amount <= 0) continue;
    out.push({
      month: String(debit.date || "").slice(0, 7),
      category: claim.category,
      amount,
    });
  }
  return out;
}
