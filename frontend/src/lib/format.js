export const CAT_COLORS = [
  "#138a86", "#4cb5b1", "#9bd3d0", "#c6e3e1",
  "#e0a23d", "#7f8fd6", "#d67f9b", "#e2efee",
];

export function colorFor(index) {
  return CAT_COLORS[index % CAT_COLORS.length];
}

// "$1,254.95" — no sign
export function money(n) {
  return "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "+$3,000.00" / "−$150.00"
export function signed(n) {
  return (n >= 0 ? "+" : "−") + money(n);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
}

// Build a conic-gradient string from [{ value, color }] segments.
export function donutGradient(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map(({ value, color }) => {
    const start = (acc / total) * 100;
    acc += value;
    const end = (acc / total) * 100;
    return `${color} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}
