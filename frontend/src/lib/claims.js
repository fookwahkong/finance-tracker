// Pure mirror of core/claims.py. A settled claim's effect reduces to
// subtracting min(received, expected) from both its category's spending and
// from income, in the debit's month. See lib/aggregate.js for application.

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
