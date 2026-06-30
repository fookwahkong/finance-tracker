import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

const iso = (d) => d.toISOString().slice(0, 10);

// Market (Polygon)
export const getTicker = (symbol) =>
  api.get(`/api/investments/market/ticker/${symbol}`).then((r) => r.data);

// ~2 years of daily bars so the chart's 1M..MAX ranges slice client-side.
export const getAggregates = (symbol) => {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);
  return api
    .get(`/api/investments/market/aggregates/${symbol}`, {
      params: { from: iso(from), to: iso(to) },
    })
    .then((r) => r.data);
};

export const getDividends = (symbol) =>
  api.get(`/api/investments/market/dividends/${symbol}`).then((r) => r.data);

// Company (Finnhub)
export const getProfile = (symbol) =>
  api.get(`/api/investments/company/profile/${symbol}`).then((r) => r.data);

export const getNews = (symbol) =>
  api.get(`/api/investments/company/news/${symbol}`).then((r) => r.data);

export const getEarnings = (symbol) =>
  api.get(`/api/investments/company/earnings/${symbol}`).then((r) => r.data);

// Financials (FMP) — annual only in v1
export const getIncome = (symbol) =>
  api.get(`/api/investments/financials/income/${symbol}`).then((r) => r.data);

export const getBalance = (symbol) =>
  api.get(`/api/investments/financials/balance/${symbol}`).then((r) => r.data);

export const getCashflow = (symbol) =>
  api.get(`/api/investments/financials/cashflow/${symbol}`).then((r) => r.data);
