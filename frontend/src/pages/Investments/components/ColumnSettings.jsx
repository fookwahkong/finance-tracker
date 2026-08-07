import { useCallback, useRef, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { OPTIONAL_COLUMNS } from "../lib/columns";

// Header control that shows/hides the optional holdings columns.
export default function ColumnSettings({ columns, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  const toggle = (key) => onChange({ ...columns, [key]: !columns[key] });

  return (
    <div className="colsettings" ref={ref}>
      <button
        type="button"
        className="colsettings-btn"
        aria-label="Choose columns"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Sliders glyph, drawn rather than pulled from an icon set */}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="2" y1="5" x2="16" y2="5" />
            <line x1="2" y1="13" x2="16" y2="13" />
          </g>
          <circle cx="11" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="6" cy="13" r="2.2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open && (
        <div className="colsettings-pop">
          <div className="colsettings-head">Columns</div>
          {OPTIONAL_COLUMNS.map((c) => (
            <label key={c.key} className="colsettings-item">
              <input
                type="checkbox"
                checked={!!columns[c.key]}
                onChange={() => toggle(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
