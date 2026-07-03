import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEarningsCalendar, getWatchlist } from "../../../api/investments";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const fmtISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Mon–Fri cells spanning the weeks that the given month touches.
function weekdayCells(year, month) {
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
  const last = new Date(year, month + 1, 0);
  const cells = [];
  const cur = new Date(start);
  while (true) {
    for (let i = 0; i < 5; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + i);
      cells.push(d);
    }
    cur.setDate(cur.getDate() + 7);
    if (cur > last) break;
  }
  return cells;
}

export default function EarningsCalendar() {
  const today = new Date();
  const todayISO = fmtISO(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [state, setState] = useState({ status: "loading", rows: [], error: null });
  const [watch, setWatch] = useState(new Set());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    getWatchlist()
      .then((rows) => setWatch(new Set(rows.map((r) => r.ticker.toUpperCase()))))
      .catch(() => setWatch(new Set()));
  }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", rows: [], error: null });
    const from = fmtISO(new Date(year, month, 1));
    const to = fmtISO(new Date(year, month + 1, 0));
    getEarningsCalendar({ from, to })
      .then((data) => { if (alive) setState({ status: "ok", rows: data?.earningsCalendar || [], error: null }); })
      .catch((e) => { if (alive) setState({ status: "error", rows: [], error: e?.response?.data?.detail || e.message }); });
    return () => { alive = false; };
  }, [year, month]);

  const byDate = {};
  state.rows.forEach((r) => { (byDate[r.date] ||= []).push(r); });

  const cells = weekdayCells(year, month);
  const shiftMonth = (delta) => setCursor(new Date(year, month + delta, 1));

  return (
    <div className="invest-card" style={{ padding: 16 }}>
      <div className="cal-head">
        <span className="cal-title">{MONTHS_LONG[month]} {year}</span>
        <div className="cal-nav">
          <button type="button" onClick={() => shiftMonth(-1)}>◀ {MONTHS[(month + 11) % 12]}</button>
          <button type="button" onClick={() => shiftMonth(1)}>{MONTHS[(month + 1) % 12]} ▶</button>
        </div>
      </div>

      {state.status === "error" && <p style={{ color: "var(--red)" }}>{state.error}</p>}

      <div className="cal-grid">
        {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d) => {
          const isoD = fmtISO(d);
          const inMonth = d.getMonth() === month;
          const isToday = isoD === todayISO;
          const entries = [...(byDate[isoD] || [])].sort(
            (a, b) => (watch.has(b.symbol) ? 1 : 0) - (watch.has(a.symbol) ? 1 : 0)
          );
          const hasWatch = entries.some((e) => watch.has(e.symbol));
          const shown = entries.slice(0, 2);
          const more = entries.length - shown.length;
          const cls = ["cal-cell"];
          if (!inMonth) cls.push("is-muted");
          if (isToday) cls.push("is-today");
          else if (hasWatch) cls.push("has-watch");
          return (
            <div key={isoD} className={cls.join(" ")}>
              <div className="cal-date">{MONTHS[d.getMonth()]} {d.getDate()}{isToday ? " ●" : ""}</div>
              {shown.map((e, i) => {
                const isW = watch.has(e.symbol);
                const pill = isW ? "watch" : e.hour === "amc" ? "amc" : "bmo";
                const suffix = isW ? " (watchlist)" : (e.hour === "bmo" || e.hour === "amc" ? ` ${e.hour}` : "");
                return (
                  <Link key={`${e.symbol}-${i}`} to={`/investment/stock/${e.symbol}`}
                    className={`cal-pill ${pill}`} title={e.symbol}>
                    {e.symbol}{suffix}
                  </Link>
                );
              })}
              {more > 0 && <span className="cal-more">+{more} more</span>}
              {isToday && <span className="cal-badge">TODAY</span>}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        <div className="cal-legend-item">
          <span className="cal-legend-sw" style={{ background: "#d4f0ed", border: "1px solid #2b9d8f" }} />
          Before market open (bmo)
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-sw" style={{ background: "#fcddd0", border: "1px solid #c04000" }} />
          After market close (amc)
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-sw" style={{ background: "var(--teal)" }} />
          Watchlist stock
        </div>
        <span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: 8 }}>
          ↑ click any symbol → opens Stock Detail page
        </span>
      </div>
    </div>
  );
}
