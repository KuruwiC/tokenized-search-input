import '@testing-library/jest-dom/vitest';

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
