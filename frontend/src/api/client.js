import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

// Transactions
export const getTransactions = (month) =>
  api.get("/api/transactions", { params: month ? { month } : {} }).then((r) => r.data);

export const createTransaction = (data) =>
  api.post("/api/transactions", data).then((r) => r.data);

export const updateTransaction = (id, data) =>
  api.put(`/api/transactions/${id}`, data).then((r) => r.data);

export const deleteTransaction = (id) =>
  api.delete(`/api/transactions/${id}`);

// Categories
export const getCategories = () =>
  api.get("/api/categories").then((r) => r.data);

export const createCategory = (name) =>
  api.post("/api/categories", { name }).then((r) => r.data);

export const deleteCategory = (id) =>
  api.delete(`/api/categories/${id}`);

// Reports
export const getMonthlyReport = (month) =>
  api.get("/api/reports/monthly", { params: { month } }).then((r) => r.data);

// Statement import
export const parseStatement = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/statements/parse", form).then((r) => r.data);
};

export const importStatement = (rows) =>
  api.post("/api/statements/import", { rows }).then((r) => r.data);
