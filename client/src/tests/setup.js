import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

// jsdom implements neither of these, and Recharts / Modal touch both.
globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

if (!globalThis.scrollTo) globalThis.scrollTo = () => {};
