import "@testing-library/jest-dom";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one to mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
