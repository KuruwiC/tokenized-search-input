import '@testing-library/jest-dom/vitest';
import { format } from 'node:util';
import { afterEach, beforeEach, vi } from 'vitest';

// Keep this list intentionally narrow. A message belongs here only when it is
// emitted by an unavoidable third-party dependency and cannot be fixed in our
// test or production code. Unexpected warnings must fail the test that emits them.
const allowedConsoleMessages: RegExp[] = [
  // React 18 reports updates scheduled by Tiptap's asynchronous NodeViews;
  // wrapping every internal update would couple these integration tests to
  // Tiptap implementation details. Keep matching limited to this exact act
  // warning and continue failing on every other React/runtime warning.
  /^Warning: An update to (?:Portals|ForwardRef\(TokenizedSearchInput2\)|SuggestionOverlay|Token|TokenValue) inside a test was not wrapped in act\(\.\.\.\)/,
];

const formatConsoleCall = (args: unknown[]) => format(...args);

const isAllowedConsoleCall = (args: unknown[]) =>
  allowedConsoleMessages.some((pattern) => pattern.test(formatConsoleCall(args)));

let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  const originalError = console.error;
  const originalWarn = console.warn;
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (!isAllowedConsoleCall(args)) originalError(...args);
  });
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isAllowedConsoleCall(args)) originalWarn(...args);
  });
});

afterEach(() => {
  try {
    const unexpected = [
      ...consoleError.mock.calls.map((args: unknown[]) => ['console.error', args] as const),
      ...consoleWarn.mock.calls.map((args: unknown[]) => ['console.warn', args] as const),
    ].filter(([, args]) => {
      return !isAllowedConsoleCall(args);
    });

    if (unexpected.length > 0) {
      const details = unexpected
        .map(([method, args]) => `${method}: ${formatConsoleCall(args)}`)
        .join('\n');
      throw new Error(`Unexpected console output detected:\n${details}`);
    }
  } finally {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  }
});

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('min-width: 768px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver for tests
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver for tests
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock scrollIntoView for tests
Element.prototype.scrollIntoView = () => {};

// Mock getClientRects for ProseMirror
Range.prototype.getClientRects = () => {
  const list: DOMRect[] = [];
  return {
    length: 0,
    item: () => null,
    [Symbol.iterator]: () => list[Symbol.iterator](),
  } as DOMRectList;
};

// Mock getBoundingClientRect for Range
Range.prototype.getBoundingClientRect = () => ({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => {},
});

// Mock document.elementFromPoint for ProseMirror
document.elementFromPoint = () => null;

// Mock createRange for Selection
document.createRange = () => {
  const range = new Range();
  return range;
};

// Mock Selection methods
if (!window.getSelection) {
  window.getSelection = () =>
    ({
      rangeCount: 0,
      addRange: () => {},
      removeAllRanges: () => {},
      getRangeAt: () => document.createRange(),
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      isCollapsed: true,
      type: 'None',
      extend: () => {},
      collapse: () => {},
      collapseToStart: () => {},
      collapseToEnd: () => {},
      selectAllChildren: () => {},
      deleteFromDocument: () => {},
      containsNode: () => false,
      setBaseAndExtent: () => {},
      setPosition: () => {},
      empty: () => {},
      modify: () => {},
      toString: () => '',
    }) as unknown as Selection;
}
