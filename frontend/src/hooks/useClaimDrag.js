import { useCallback, useEffect, useRef, useState } from "react";

export function dragPreviewPosition(
  clientX,
  clientY,
  viewportWidth,
  viewportHeight,
  previewWidth = 280,
  previewHeight = 88,
  offset = 14,
) {
  const renderedWidth = Math.min(previewWidth, Math.max(0, viewportWidth - (offset * 2)));
  const maxLeft = Math.max(offset, viewportWidth - renderedWidth - offset);
  const left = Math.min(Math.max(offset, clientX + offset), maxLeft);
  const fitsBelow = clientY + offset + previewHeight <= viewportHeight - offset;
  const top = fitsBelow ? clientY + offset : Math.max(offset, clientY - previewHeight - offset);
  return { left, top };
}

export function edgeScrollSpeed(clientY, viewportHeight, edgeSize = 96, maxSpeed = 18) {
  if (!(clientY > 0) || !(viewportHeight > 0)) return 0;
  if (clientY < edgeSize) {
    return -Math.round(maxSpeed * (edgeSize - clientY) / edgeSize);
  }
  if (clientY > viewportHeight - edgeSize) {
    return Math.round(maxSpeed * (clientY - (viewportHeight - edgeSize)) / edgeSize);
  }
  return 0;
}

export function useClaimDrag() {
  const [dragPreview, setDragPreview] = useState(null);
  const activeRef = useRef(false);
  const frameRef = useRef(null);
  const speedRef = useRef(0);

  const runScrollFrame = useCallback(function runScrollFrame() {
    frameRef.current = null;
    if (!speedRef.current) return;
    window.scrollBy(0, speedRef.current);
    frameRef.current = window.requestAnimationFrame(runScrollFrame);
  }, []);

  const stopScrolling = useCallback(() => {
    speedRef.current = 0;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const moveDrag = useCallback((event) => {
    const { clientX, clientY } = event;
    if (!activeRef.current || !(clientY > 0)) return;

    setDragPreview((current) => current ? { ...current, x: clientX, y: clientY } : current);
    const nextSpeed = edgeScrollSpeed(clientY, window.innerHeight);
    speedRef.current = nextSpeed;

    if (nextSpeed && frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(runScrollFrame);
    } else if (!nextSpeed && frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, [runScrollFrame]);

  const startDrag = useCallback((event, credit) => {
    activeRef.current = true;
    event.dataTransfer.setData("text/credit-id", credit.id);

    const transparentImage = document.createElement("canvas");
    transparentImage.width = 1;
    transparentImage.height = 1;
    event.dataTransfer.setDragImage(transparentImage, 0, 0);

    setDragPreview({ credit, x: event.clientX, y: event.clientY });
    moveDrag(event);
  }, [moveDrag]);

  const endDrag = useCallback(() => {
    activeRef.current = false;
    stopScrolling();
    setDragPreview(null);
  }, [stopScrolling]);

  const isDragging = dragPreview !== null;
  useEffect(() => {
    if (!isDragging) return undefined;
    document.addEventListener("dragover", moveDrag, true);
    return () => document.removeEventListener("dragover", moveDrag, true);
  }, [isDragging, moveDrag]);

  useEffect(() => () => {
    activeRef.current = false;
    stopScrolling();
  }, [stopScrolling]);

  return { dragPreview, startDrag, moveDrag, endDrag };
}
