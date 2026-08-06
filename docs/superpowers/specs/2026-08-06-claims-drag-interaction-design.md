# Claims Drag Interaction Design

## Goal

Make repayment transactions feel directly draggable in the Claims view. While dragging, the user must see the selected transaction follow the pointer and be able to reach participant cards outside the current viewport through automatic page scrolling.

## Current Behavior

The Claims view uses native HTML drag events. A credit row is marked `draggable`, and `dragstart` stores its transaction ID in `dataTransfer`. Participant cards accept `dragover` and read that ID on `drop`, then open the existing assignment dialog.

There is no application-managed drag state, pointer tracking, preview layer, edge detection, scrolling loop, or drop-target feedback. The browser alone controls the drag ghost and scrolling behavior, which is inconsistent and provides insufficient feedback.

## Chosen Approach

Retain native HTML drag and the current transaction-assignment flow, while adding an application-managed interaction layer. This avoids a new dependency and limits the change to the Claims frontend.

During `dragstart`, Claims will store the dragged credit in React state, hide the browser's default drag image, and begin tracking drag coordinates. A fixed, pointer-events-disabled preview will be rendered through a portal so it is not clipped by Claims containers. It will show the transaction name, date, and available amount.

A document-level drag listener will update the preview position and determine whether the pointer is within 96 pixels of the viewport top or bottom. A single `requestAnimationFrame` loop will call `window.scrollBy` while the pointer remains in an edge zone. Scroll speed will increase as the pointer approaches the edge and will be capped to remain controllable.

## Interaction Details

- The preview appears only for a valid available repayment transaction.
- The preview follows the pointer with a small offset so it does not obscure the target.
- The top and bottom edge zones work across the full viewport, not only over Claims content.
- Auto-scroll stops as soon as the pointer leaves an edge zone.
- Auto-scroll and preview state are cleared on drop, drag end, cancellation, and component unmount.
- A participant card receives a visible active-target style while the dragged credit is over it.
- Dropping still opens the existing participant-specific assignment dialog with the dragged credit selected.
- The existing **Assign repayment** button remains unchanged as the keyboard and non-drag alternative.

## Component Boundaries

Drag lifecycle and edge-scrolling mechanics will live in a focused reusable hook. The hook will expose the active drag item, its preview position, and handlers for starting, moving, and ending a drag. Claims remains responsible for rendering transaction-specific preview content and opening the assignment dialog.

Drop-target state remains local to Claims because it depends on claim and participant identifiers.

## Error and Edge Handling

- Drag events with missing or zero coordinates will not move the preview or trigger scrolling.
- No scrolling occurs when the document cannot scroll further.
- Only one animation frame loop may run at a time.
- Stale drag state cannot survive a completed or cancelled drag.
- An invalid or fully allocated credit ID is ignored by the existing drop validation.

## Testing

Tests will be written before implementation and will cover:

1. Starting a drag shows a preview containing the correct transaction details.
2. Drag movement updates the preview coordinates.
3. Entering top and bottom edge zones requests scrolling in the correct direction.
4. Leaving an edge zone and ending the drag stop the scrolling loop.
5. Participant hover applies and removes the active target state.
6. Dropping opens the correct assignment dialog and clears all drag UI.
7. Existing click assignment and modal accessibility behavior continue to pass.

The complete frontend test suite, lint, and production build will be run after implementation.
