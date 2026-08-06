# Claims Drag Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pointer-following repayment preview and viewport-edge auto-scroll to the Claims drag-and-drop flow.

**Architecture:** A focused React hook will own active drag state, pointer coordinates, edge-speed calculation, the animation-frame scroll loop, and cleanup. `Claims.jsx` will render transaction-specific preview content, keep participant drop-target state, and retain the existing assignment dialog and native data-transfer contract.

**Tech Stack:** React 18, JavaScript/JSX, HTML Drag and Drop API, Vitest, Testing Library, CSS

---

### Task 1: Drag lifecycle and edge-scrolling hook

**Files:**
- Create: `frontend/src/hooks/useClaimDrag.js`
- Create: `frontend/src/hooks/useClaimDrag.test.jsx`

- [ ] **Step 1: Write failing tests for edge speed and drag lifecycle**

Create tests that import `edgeScrollSpeed` and `useClaimDrag`, assert zero speed outside the 96-pixel zones, proportional negative/positive speeds inside them, preview state after `startDrag`, `window.scrollBy` after the scheduled frame, and cleanup after `endDrag`.

```jsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { edgeScrollSpeed, useClaimDrag } from "./useClaimDrag";

describe("edgeScrollSpeed", () => {
  it("returns proportional speed only inside viewport edge zones", () => {
    expect(edgeScrollSpeed(200, 800)).toBe(0);
    expect(edgeScrollSpeed(48, 800)).toBe(-9);
    expect(edgeScrollSpeed(752, 800)).toBe(9);
  });
});

describe("useClaimDrag", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tracks a preview, scrolls at an edge, and clears everything on drag end", () => {
    let frame;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frame = callback; return 7; });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const { result } = renderHook(() => useClaimDrag());
    const setDragImage = vi.fn();
    const setData = vi.fn();
    const credit = { id: "credit-1", item: "PayNow", amount: 50 };

    act(() => result.current.startDrag({ clientX: 120, clientY: 100, dataTransfer: { setData, setDragImage } }, credit));
    expect(result.current.dragPreview).toMatchObject({ credit, x: 120, y: 100 });
    expect(setData).toHaveBeenCalledWith("text/credit-id", "credit-1");
    expect(setDragImage).toHaveBeenCalled();

    act(() => result.current.moveDrag({ clientX: 140, clientY: window.innerHeight - 10 }));
    act(() => frame());
    expect(scroll).toHaveBeenCalledWith(0, expect.any(Number));

    act(() => result.current.endDrag());
    expect(result.current.dragPreview).toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the hook test and confirm RED**

Run: `npm test -- src/hooks/useClaimDrag.test.jsx`

Expected: FAIL because `useClaimDrag.js` does not exist.

- [ ] **Step 3: Implement the minimal hook**

Implement and export:

```js
export function edgeScrollSpeed(clientY, viewportHeight, edgeSize = 96, maxSpeed = 18) {
  if (!(clientY > 0) || !(viewportHeight > 0)) return 0;
  if (clientY < edgeSize) return -Math.round(maxSpeed * (edgeSize - clientY) / edgeSize);
  if (clientY > viewportHeight - edgeSize) return Math.round(maxSpeed * (clientY - (viewportHeight - edgeSize)) / edgeSize);
  return 0;
}
```

`useClaimDrag` must expose `{ dragPreview, startDrag, moveDrag, endDrag }`. It must use one `requestAnimationFrame` loop, store current speed in a ref, call `window.scrollBy(0, speed)`, install a capturing document `dragover` listener while active, hide the native preview with a transparent one-pixel image, and cancel the loop/listener during drag end and unmount.

- [ ] **Step 4: Run the hook test and confirm GREEN**

Run: `npm test -- src/hooks/useClaimDrag.test.jsx`

Expected: all hook tests PASS.

- [ ] **Step 5: Commit the hook**

```powershell
git add frontend/src/hooks/useClaimDrag.js frontend/src/hooks/useClaimDrag.test.jsx
git commit -m "feat: add claims drag interaction hook"
```

### Task 2: Claims preview and participant target feedback

**Files:**
- Modify: `frontend/src/pages/Spending/Claims.jsx`
- Modify: `frontend/src/pages/Spending/Claims.test.jsx`

- [ ] **Step 1: Write failing interaction tests**

Extend the existing drag test so `dataTransfer` also supplies `setDragImage`. After `dragStart`, assert a `claim-drag-preview` test ID contains the transaction name, date, and available amount. Fire a drag event with new coordinates and assert its transform changes. Fire `dragEnter` on Alex and assert `is-drag-target`; fire `dragLeave` and assert removal. Drop on Alex and assert the preview disappears while the participant-specific dialog opens.

```jsx
expect(within(screen.getByTestId("claim-drag-preview")).getByText("Available PayNow")).toBeInTheDocument();
expect(screen.getByTestId("claim-drag-preview")).toHaveStyle({ transform: "translate3d(134px, 134px, 0)" });
fireEvent.dragEnter(alex);
expect(alex).toHaveClass("is-drag-target");
fireEvent.dragLeave(alex, { relatedTarget: document.body });
expect(alex).not.toHaveClass("is-drag-target");
fireEvent.drop(alex, { dataTransfer });
expect(screen.queryByTestId("claim-drag-preview")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the Claims test and confirm RED**

Run: `npm test -- src/pages/Spending/Claims.test.jsx`

Expected: FAIL because no managed preview or active-target class exists.

- [ ] **Step 3: Integrate the hook into Claims**

Import `useClaimDrag`, create `dropTargetId` state, and call the hook. Replace the credit row's inline `onDragStart` with `startDrag(event, credit)`, add `onDrag={moveDrag}` and `onDragEnd={endDrag}`. Participant cards must set and clear a `${claim.id}:${participant.id}` target key and call `endDrag()` after reading the dropped credit ID.

Render this portal alongside the existing assignment portal:

```jsx
{dragPreview && createPortal(
  <div
    className="claim-drag-preview"
    data-testid="claim-drag-preview"
    aria-hidden="true"
    style={{ transform: `translate3d(${dragPreview.x + 14}px, ${dragPreview.y + 14}px, 0)` }}
  >
    <span>Repayment</span>
    <strong>{dragPreview.credit.item}</strong>
    <small>{dragPreview.credit.date || "Credit transaction"}</small>
    <b>{money(dragPreview.credit.available)}</b>
  </div>,
  document.body,
)}
```

- [ ] **Step 4: Run interaction tests and confirm GREEN**

Run: `npm test -- src/pages/Spending/Claims.test.jsx src/hooks/useClaimDrag.test.jsx`

Expected: all drag hook and Claims interaction tests PASS.

- [ ] **Step 5: Commit the integration**

```powershell
git add frontend/src/pages/Spending/Claims.jsx frontend/src/pages/Spending/Claims.test.jsx
git commit -m "feat: add interactive claims drag feedback"
```

### Task 3: Styling and complete verification

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add fixed preview and target styles**

Add a fixed, high-z-index preview with `pointer-events: none`, compact transaction typography, shadow, and reduced-motion-safe transitions. Add `.claim-person.is-drag-target` with a teal border, soft background, and inset focus ring. Ensure the preview remains within a readable width on small screens.

```css
.claim-drag-preview {
  position: fixed;
  z-index: 1200;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 16px;
  width: min(280px, calc(100vw - 28px));
  padding: 12px 14px;
  border: 1px solid rgba(18, 126, 120, .28);
  border-radius: 14px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 18px 45px rgba(22, 48, 47, .2);
  pointer-events: none;
}
.claim-drag-preview > span,
.claim-drag-preview > small { color: var(--muted); font-size: 11px; }
.claim-drag-preview > strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.claim-drag-preview > b { grid-column: 2; grid-row: 1 / span 3; align-self: center; color: var(--teal); }
.claim-person.is-drag-target {
  border-color: var(--teal);
  background: var(--teal-soft);
  box-shadow: inset 0 0 0 1px var(--teal);
}
```

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/hooks/useClaimDrag.test.jsx src/pages/Spending/Claims.test.jsx`

Expected: all focused tests PASS.

- [ ] **Step 3: Run complete verification**

Run: `npm test`

Expected: all frontend tests PASS.

Run: `npm run lint`

Expected: exit 0 with no new errors.

Run: `npm run build`

Expected: production build succeeds; the existing bundle-size warning is acceptable.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Commit styling**

```powershell
git add frontend/src/index.css
git commit -m "style: polish claims drag feedback"
```
