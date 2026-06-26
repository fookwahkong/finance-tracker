import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

// Investments — raw Polygon market data
export const getTicker = (symbol) =>
  api.get(`/api/investments/market/ticker/${symbol}`).then((r) => r.data);

export const getPrevClose = (symbol) =>
  api.get(`/api/investments/market/prev-close/${symbol}`).then((r) => r.data);

export const getAggregates = (symbol) =>
  api.get(`/api/investments/market/aggregates/${symbol}`).then((r) => r.data);

export const getDividends = (symbol) =>
  api.get(`/api/investments/market/dividends/${symbol}`).then((r) => r.data);

export const getSma = (symbol) =>
  api.get(`/api/investments/market/sma/${symbol}`).then((r) => r.data);
