import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lookupTerm } from "../lib/glossary";

// Wraps a metric label. If the glossary covers it, the label becomes a
// click-to-learn control; if not it renders as plain text, so callers can wrap
// every label without checking coverage first.
export default function TermInfo({ label }) {
  const entry = lookupTerm(label);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // `?? null` because React throws on an undefined return, and callers pass
  // whatever label their data happens to carry.
  if (!entry) return label ?? null;

  return (
    <>
      <button type="button" className="term-info" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="modal-panel term-panel"
            role="dialog"
            aria-modal="true"
            aria-label={entry.term}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-title">{entry.term}</div>
              <button
                type="button"
                className="term-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="term-meaning">{entry.meaning}</p>
            <div className="term-implication-label">What it tells you</div>
            <p className="term-implication">{entry.implication}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
