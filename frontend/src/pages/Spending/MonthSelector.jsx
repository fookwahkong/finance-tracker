import { useMemo } from "react";
import { yearsInData } from "../../lib/aggregate";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Spending's way of choosing a period: a year dropdown and twelve month
// buttons. It lives here rather than inside Overview because Overview is now
// period-generic — Travel fills the same slot with a trip chip instead.
export default function MonthSelector({ transactions, year, monthNum, onYearChange, onMonthChange }) {
  const years = useMemo(() => yearsInData(transactions), [transactions]);

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="month-btns">
        <select
          className="select"
          style={{ width: "auto", marginLeft: 8 }}
          aria-label="Year"
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
        >
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>

        {MONTH_ABBR.map((m, i) => {
          const mm = String(i + 1).padStart(2, "0");
          return (
            <button
              key={mm}
              type="button"
              className={`month-btn${mm === monthNum ? " is-active" : ""}`}
              onClick={() => onMonthChange(mm)}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
