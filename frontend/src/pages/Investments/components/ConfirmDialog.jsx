import { useEffect } from "react";
import { createPortal } from "react-dom";

// Styled confirm, reusing the modal shell TradeForm already established.
// Not window.confirm: that can't carry the blast-radius wording a destructive
// action needs, and it's missing in some embedded browser previews.
export default function ConfirmDialog({
  open, title, body, confirmLabel = "Delete", busy, error, onConfirm, onCancel,
}) {
  // Escape cancels, but not mid-delete — the request is already in flight.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <div
        className="modal-panel confirm-panel"
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">{title}</div>
        </div>
        <p className="confirm-body">{body}</p>
        {error && <p className="confirm-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
