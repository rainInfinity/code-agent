import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => callback(performance.now()), 16);
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  }

  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value(options: ScrollToOptions | number, top?: number) {
      if (typeof options === 'number') {
        this.scrollTop = top ?? 0;
        return;
      }

      this.scrollTop = options.top ?? this.scrollTop;
    },
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
