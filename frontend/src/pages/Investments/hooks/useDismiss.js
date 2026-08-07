import { useEffect } from "react";

// Close a popover when the pointer goes down outside `ref` or Escape is
// pressed. Listeners are only attached while `active`, so a table of closed
// menus costs nothing.
export function useDismiss(ref, onClose, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active]);
}
