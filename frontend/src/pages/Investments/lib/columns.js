// Which optional holdings columns are visible, persisted so the choice
// survives a reload. Symbols / Price / Value / Quantity are always shown and
// are deliberately absent here — they can't be switched off.

export const OPTIONAL_COLUMNS = [
  { key: "change", label: "Change" },
  { key: "gain", label: "Total gain/loss" },
  { key: "weight", label: "% of portfolio" },
  { key: "avgCost", label: "Avg cost basis" },
];

export const STORAGE_KEY = "invest.holdings.columns";

export const allVisible = () =>
  Object.fromEntries(OPTIONAL_COLUMNS.map((c) => [c.key, true]));

// Only an explicit `false` hides a column. Corrupt JSON, a non-object, or a
// key added since the value was written all fall back to visible — a bad
// stored value should never silently hide data.
export function parseColumns(raw) {
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    return allVisible();
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return allVisible();
  return Object.fromEntries(
    OPTIONAL_COLUMNS.map((c) => [c.key, stored[c.key] !== false])
  );
}

export function loadColumns() {
  try {
    return parseColumns(localStorage.getItem(STORAGE_KEY));
  } catch {
    return allVisible();
  }
}

export function saveColumns(columns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Storage disabled (private mode, quota) — the choice just won't persist.
  }
}
