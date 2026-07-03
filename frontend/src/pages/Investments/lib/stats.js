import { money } from "../../../lib/format";

const DASH = "—";

export function latestBar(bars) {
  return bars && bars.length ? bars[bars.length - 1] : null;
}

export function dayChange(bars) {
  if (!bars || bars.length < 2) return null;
  const prev = bars[bars.length - 2].c;
  const last = bars[bars.length - 1].c;
  return { abs: last - prev, pct: (prev ? ((last - prev) / prev) * 100 : 0) };
}

const num = (v) => (v == null ? null : v.toLocaleString("en-US"));

export function buildStatGrid({ bars, profile, dividends }) {
  const last = latestBar(bars);
  const div = dividends && Array.isArray(dividends.results) ? dividends.results[0] : null;
  const close = last ? last.c : null;

  let yieldVal = DASH;
  if (div && div.cash_amount != null && div.frequency && close) {
    yieldVal = ((div.cash_amount * div.frequency) / close * 100).toFixed(2) + "%";
  }

  const row = (label, value) => ({ label, value: value == null ? DASH : value });
  return [
    row("Open", last ? money(last.o) : null),
    row("High", last ? money(last.h) : null),
    row("Low", last ? money(last.l) : null),
    row("Volume", last ? num(last.v) : null),
    row("Mkt. cap", profile && profile.marketCapitalization != null
      ? "$" + num(profile.marketCapitalization) + "M" : null),
    row("Dividend (yield)", div ? yieldVal : null),
    row("Quarterly dividend", div && div.cash_amount != null ? money(div.cash_amount) : null),
    row("Ex dividend date", div && div.ex_dividend_date ? div.ex_dividend_date : null),
  ];
}
