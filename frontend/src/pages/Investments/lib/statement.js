const DASH = "—";

export function statementColumns(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map((p) => String(p.calendarYear || p.fiscalYear || p.date || ""));
}

export function statementRows(periods, fields) {
  if (!Array.isArray(periods)) return [];
  return fields.map(({ key, label }) => ({
    label,
    values: periods.map((p) => {
      const v = p[key];
      if (v == null) return DASH;
      return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
    }),
  }));
}
