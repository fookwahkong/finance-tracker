import { useCallback, useRef, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";

// Per-row ⋮ menu. Edit is a disabled placeholder — that action is reserved for
// a future AI feature and has no handler yet.
export default function RowMenu({ label, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  return (
    // The row itself navigates on click, so the menu swallows its own clicks.
    <div className="rowmenu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rowmenu-btn"
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open && (
        <div className="rowmenu-pop" role="menu">
          <button type="button" className="rowmenu-item" role="menuitem" disabled>
            Edit<span className="rowmenu-hint">Coming soon</span>
          </button>
          <button
            type="button"
            className="rowmenu-item is-danger"
            role="menuitem"
            onClick={() => { close(); onDelete(); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
