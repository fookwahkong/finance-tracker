// Canonical category set, shared by Spending, Budget, Dashboard and the
// emoji icons. Names must match the backend `categories` seed exactly.
export const CATEGORY_EMOJI = {
  "Groceries": "🛒",
  "Food & Drink": "🍔",
  "Transport": "🚆",
  "Personal": "🧴",
  "Pets": "🐾",
  "Gym": "🏋️",
  "Shopping": "🛍️",
  "Education": "📚",
  "Car": "🚗",
  "Housing": "🏠",
  "Gifts": "🎁",
  "Work": "💼",
  "Sports & Hobby": "⚽",
  "Beauty": "💄",
  "Others": "📦",
  "Travel": "✈️",
};

export const CATEGORIES = Object.keys(CATEGORY_EMOJI);

// Emoji for a category name; falls back to a neutral box for unknown or
// user-added categories (and for transactions with no category).
export function emojiFor(name) {
  return CATEGORY_EMOJI[name] || "📦";
}
