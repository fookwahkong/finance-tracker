const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (value) => value / 100;

export const participantNameKey = (name) => String(name)
  .trim()
  .normalize("NFKC")
  .toUpperCase()
  .toLowerCase()
  .replaceAll("ß", "ss")
  .normalize("NFKC");

function normalizedParticipant(participant, claimId) {
  return {
    id: participant.id,
    claimId: participant.claim_id || claimId,
    name: participant.name || (participant.is_owner ? "You" : "Someone"),
    isOwner: Boolean(participant.is_owner ?? participant.isOwner),
    shareAmount: Number(participant.share_amount ?? participant.shareAmount ?? 0),
    sharePercent: Number(participant.share_percent ?? participant.sharePercent ?? 0),
    links: participant.links || participant.allocations || [],
    received: participant.received == null ? null : Number(participant.received),
    legacy: Boolean(participant.legacy),
  };
}

export function calculateClaimSplit(total, names, ownerPercent = null) {
  const totalNumber = Number(total);
  const cleanNames = (names || []).map((name) => String(name).trim());
  const errors = {};

  if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
    errors.total = "The expense total must be greater than 0.";
  }
  if (cleanNames.length === 0) {
    errors.names = "Add at least one person to share this expense.";
  } else if (cleanNames.some((name) => !name)) {
    errors.names = "Participant names cannot be blank.";
  }

  const comparableNames = cleanNames.filter(Boolean).map(participantNameKey);
  if (new Set(comparableNames).size !== comparableNames.length) {
    errors.duplicates = "Each participant name must be unique.";
  } else if (comparableNames.includes(participantNameKey("You"))) {
    errors.duplicates = '"You" is already included as the payer.';
  }

  const mode = ownerPercent == null ? "equal" : "custom";
  const parsedOwnerPercent = mode === "equal"
    ? (cleanNames.length ? 100 / (cleanNames.length + 1) : 100)
    : Number(ownerPercent);

  if (mode === "custom") {
    if (!Number.isFinite(parsedOwnerPercent)) {
      errors.ownerPercent = "Enter a valid percentage.";
    } else if (parsedOwnerPercent < 0) {
      errors.ownerPercent = "Your share must be at least 0%.";
    } else if (parsedOwnerPercent >= 100) {
      errors.ownerPercent = "Your share must be less than 100%.";
    }
  }

  const totalCents = Number.isFinite(totalNumber) && totalNumber > 0 ? toCents(totalNumber) : 0;
  const namedCount = cleanNames.length;
  let ownerCents = totalCents;
  let namedPercent = 0;
  let namedCentsList = [];

  if (namedCount > 0 && !errors.ownerPercent) {
    if (mode === "equal") {
      // Leftover cent from the integer split goes to the owner (You).
      const namedCentsEach = Math.floor(totalCents / (namedCount + 1));
      ownerCents = totalCents - (namedCentsEach * namedCount);
      namedPercent = 100 / (namedCount + 1);
      namedCentsList = new Array(namedCount).fill(namedCentsEach);
    } else {
      // Owner's cents are exactly the requested percentage; the leftover
      // cent from dividing the remainder goes to a participant instead, so
      // an explicit 0% (or any %) request is honored exactly.
      ownerCents = Math.round(totalCents * parsedOwnerPercent / 100);
      const namedTotalCents = totalCents - ownerCents;
      const namedCentsEach = Math.floor(namedTotalCents / namedCount);
      namedPercent = (100 - parsedOwnerPercent) / namedCount;
      namedCentsList = new Array(namedCount).fill(namedCentsEach);
      namedCentsList[namedCount - 1] += namedTotalCents - (namedCentsEach * namedCount);
    }
  }

  const owner = {
    id: "owner",
    name: "You",
    isOwner: true,
    percent: parsedOwnerPercent,
    amount: fromCents(ownerCents),
  };
  const namedParticipants = cleanNames.map((name, index) => ({
    id: `person-${index}`,
    name,
    isOwner: false,
    percent: namedPercent,
    amount: fromCents(namedCentsList[index] ?? 0),
  }));

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    mode,
    ownerPercent: parsedOwnerPercent,
    participants: [owner, ...namedParticipants],
    namedParticipants,
    ownerAmount: owner.amount,
    expectedAmount: fromCents(totalCents - ownerCents),
  };
}

export function participantsForClaim(claim) {
  if (Array.isArray(claim.participants) && claim.participants.length > 0) {
    return claim.participants.map((participant) => normalizedParticipant(participant, claim.id));
  }

  const total = Number(claim.total || 0);
  const ownerAmount = Number(claim.my_share || 0);
  const expected = Number(claim.expected || Math.max(0, total - ownerAmount));
  const percentage = (amount) => total > 0 ? (amount / total) * 100 : 0;

  return [
    normalizedParticipant({
      id: `${claim.id}:owner`,
      name: "You",
      is_owner: true,
      share_amount: ownerAmount,
      share_percent: percentage(ownerAmount),
    }, claim.id),
    normalizedParticipant({
      id: `${claim.id}:legacy`,
      name: claim.counterparty || "Someone",
      is_owner: false,
      share_amount: expected,
      share_percent: percentage(expected),
      links: claim.links || [],
      legacy: true,
    }, claim.id),
  ];
}

export function participantBalance(participant) {
  const owed = Number(participant.shareAmount || 0);
  const received = participant.received == null
    ? (participant.links || []).reduce((sum, link) => sum + Number(link.allocated_amount || 0), 0)
    : Number(participant.received);
  const remaining = fromCents(toCents(owed - received));

  return {
    owed,
    received,
    remaining,
    overpaid: remaining < 0 ? Math.abs(remaining) : 0,
    progress: owed > 0 ? Math.min(received / owed, 1) : 1,
  };
}

export function claimCreatePayload(debitTransactionId, split) {
  const participantNames = split.namedParticipants.map((participant) => participant.name);
  return {
    debit_tx_id: debitTransactionId,
    participant_names: participantNames,
    split_mode: split.mode,
    my_share_percent: split.ownerPercent,
    my_share: split.ownerAmount,
    counterparty: participantNames.join(", "),
  };
}

export function linksForClaims(claims) {
  return claims.flatMap((claim) => {
    if (Array.isArray(claim.participants) && claim.participants.length > 0) {
      return claim.participants.flatMap((participant) => participant.links || participant.allocations || []);
    }
    return claim.links || [];
  });
}
