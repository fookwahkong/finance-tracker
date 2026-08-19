import api from "./http";

export const getTravelGroups = () =>
  api.get("/api/travel/groups").then((r) => r.data);

export const createTravelGroup = (data) =>
  api.post("/api/travel/groups", data).then((r) => r.data);

export const updateTravelGroup = (id, data) =>
  api.put(`/api/travel/groups/${id}`, data).then((r) => r.data);

export const deleteTravelGroup = (id) =>
  api.delete(`/api/travel/groups/${id}`);

// Force a transaction into ('include') or out of ('exclude') a trip, for the
// two cases plain date derivation gets wrong: pre-booked flights, and bills
// that auto-debit mid-trip.
export const setTravelOverride = (groupId, transactionId, mode) =>
  api
    .post(`/api/travel/groups/${groupId}/transactions`, { transaction_id: transactionId, mode })
    .then((r) => r.data);

export const clearTravelOverride = (groupId, transactionId) =>
  api.delete(`/api/travel/groups/${groupId}/transactions/${transactionId}`);
