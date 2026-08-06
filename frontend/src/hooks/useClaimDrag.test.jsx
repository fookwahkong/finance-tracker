import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dragPreviewPosition, edgeScrollSpeed, useClaimDrag } from "./useClaimDrag";

describe("dragPreviewPosition", () => {
  it("keeps the preview visible and flips it above a bottom-edge pointer", () => {
    expect(dragPreviewPosition(120, 120, 1024, 768)).toEqual({ left: 134, top: 134 });
    expect(dragPreviewPosition(1000, 760, 1024, 768)).toEqual({ left: 730, top: 658 });
    expect(dragPreviewPosition(-40, -40, 1024, 768)).toEqual({ left: 14, top: 14 });
  });
});

describe("edgeScrollSpeed", () => {
  it("returns proportional speed only inside viewport edge zones", () => {
    expect(edgeScrollSpeed(200, 800)).toBe(0);
    expect(edgeScrollSpeed(48, 800)).toBe(-9);
    expect(edgeScrollSpeed(752, 800)).toBe(9);
  });

  it("ignores missing drag coordinates", () => {
    expect(edgeScrollSpeed(0, 800)).toBe(0);
    expect(edgeScrollSpeed(undefined, 800)).toBe(0);
  });

  it("caps coordinates beyond the viewport at the maximum speed", () => {
    expect(edgeScrollSpeed(-50, 800)).toBe(-18);
    expect(edgeScrollSpeed(850, 800)).toBe(18);
  });
});

describe("useClaimDrag", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tracks a preview, scrolls at an edge, and clears everything on drag end", () => {
    let frame;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 7;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(2000);
    const { result } = renderHook(() => useClaimDrag());
    const setDragImage = vi.fn();
    const setData = vi.fn();
    const credit = { id: "credit-1", item: "PayNow", amount: 50 };

    act(() => result.current.startDrag({
      clientX: 120,
      clientY: 100,
      dataTransfer: { setData, setDragImage },
    }, credit));

    expect(result.current.dragPreview).toMatchObject({ credit, x: 120, y: 100 });
    expect(setData).toHaveBeenCalledWith("text/credit-id", "credit-1");
    expect(setDragImage).toHaveBeenCalled();

    act(() => result.current.moveDrag({ clientX: 140, clientY: window.innerHeight - 10 }));
    act(() => frame());
    expect(scroll).toHaveBeenCalledWith(0, expect.any(Number));

    act(() => result.current.endDrag());
    expect(result.current.dragPreview).toBeNull();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("cancels scheduled edge scrolling when unmounted", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 9);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useClaimDrag());

    act(() => result.current.startDrag({
      clientX: 80,
      clientY: 80,
      dataTransfer: { setData: vi.fn(), setDragImage: vi.fn() },
    }, { id: "credit-1" }));
    act(() => result.current.moveDrag({ clientX: 80, clientY: window.innerHeight - 5 }));
    unmount();

    expect(cancel).toHaveBeenCalledWith(9);
  });

  it.each([
    { edge: "top", scrollY: 0, clientY: 1 },
    { edge: "bottom", scrollY: 1232, clientY: 767 },
  ])("stops scheduling frames at the document $edge boundary", ({ scrollY, clientY }) => {
    let frame;
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 11;
    });
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(768);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(scrollY);
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(2000);
    const { result } = renderHook(() => useClaimDrag());

    act(() => result.current.startDrag({
      clientX: 80,
      clientY: 120,
      dataTransfer: { setData: vi.fn(), setDragImage: vi.fn() },
    }, { id: "credit-1" }));
    act(() => result.current.moveDrag({ clientX: 80, clientY }));
    act(() => frame());

    expect(scroll).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });
});
