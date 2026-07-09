import api from "./http";

export const getClaims = (status) =>
  api.get("/api/claims", { params: status ? { status } : {} }).then((r) => r.data);

export const createClaim = (data) =>
  api.post("/api/claims", data).then((r) => r.data);

export const linkCredit = (claimId, data) =>
  api.post(`/api/claims/${claimId}/credits`, data).then((r) => r.data);

export const unlinkCredit = (claimId, linkId) =>
  api.delete(`/api/claims/${claimId}/credits/${linkId}`);

export const settleClaim = (claimId) =>
  api.post(`/api/claims/${claimId}/settle`).then((r) => r.data);

export const reopenClaim = (claimId) =>
  api.post(`/api/claims/${claimId}/reopen`).then((r) => r.data);

export const deleteClaim = (claimId) =>
  api.delete(`/api/claims/${claimId}`);
