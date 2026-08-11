export const queryKeys = {
  transactions: (month) => ["transactions", month || "all"],
  categories: ["categories"],
  budgets: ["budgets"],
  monthlyReport: (month) => ["monthlyReport", month],
  claims: ["claims"],
  investTransactions: ["investTransactions"],
};
