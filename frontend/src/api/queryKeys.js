export const queryKeys = {
  transactions: (month) => ["transactions", month || "all"],
  categories: ["categories"],
  budgets: ["budgets"],
  subscriptions: ["subscriptions"],
  savings: ["savings"],
  monthlyReport: (month) => ["monthlyReport", month],
  claims: ["claims"],
  travelGroups: ["travelGroups"],
  investTransactions: ["investTransactions"],
};
