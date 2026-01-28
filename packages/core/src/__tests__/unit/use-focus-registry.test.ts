/**
 * Unit tests for Focus Registry.
 *
 * Tests the parameterized navigation primitives that consolidate
 * the 8 original focus methods into 2 core functions.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusableElement } from '../../tokens/composition/contexts';
import { useFocusRegistry } from '../../tokens/composition/focus/use-focus-registry';

function createMockElement(
  id: string,
  options: { entryFocusable?: boolean } = {}
): FocusableElement & { element: HTMLDivElement } {
  const { entryFocusable = true } = options;
  const focusFn = vi.fn();
  const element = document.createElement('div');
  element.setAttribute('data-testid', id);

  return {
    id,
    ref: { current: element },
    focus: focusFn,
    entryFocusable,
    element,
  };
}

/**
 * Appends mock element to container.
 * Since createMockElement always creates a valid element, this is safe.
 */
function appendToContainer(
  container: HTMLDivElement,
  mockElement: FocusableElement & { element: HTMLDivElement }
): void {
  container.appendChild(mockElement.element);
}

describe('Focus Registry', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('register', () => {
    it('registers and unregisters elements', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('test');

      const unregister = result.current.register(element);
      expect(result.current.getElements()).toHaveLength(1);

      unregister();
      expect(result.current.getElements()).toHaveLength(0);
    });

    it('maintains multiple elements', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      result.current.register(element1);
      result.current.register(element2);
      expect(result.current.getElements()).toHaveLength(2);
    });
  });

  describe('navigateAbsolute', () => {
    it('focuses first element', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.navigateAbsolute('first');
      expect(element1.focus).toHaveBeenCalledWith(undefined);
    });

    it('focuses last element', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.navigateAbsolute('last');
      expect(element2.focus).toHaveBeenCalledWith(undefined);
    });

    it('focuses first with position', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.navigateAbsolute('first', { position: 'start' });
      expect(element.focus).toHaveBeenCalledWith('start');
    });

    it('focuses last with position', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.navigateAbsolute('last', { position: 'end' });
      expect(element.focus).toHaveBeenCalledWith('end');
    });

    it('focuses first entryFocusable element with filter', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const entry1 = createMockElement('entry1', { entryFocusable: true });
      const entry2 = createMockElement('entry2', { entryFocusable: true });

      appendToContainer(container, notEntry);
      appendToContainer(container, entry1);
      appendToContainer(container, entry2);
      result.current.register(notEntry);
      result.current.register(entry1);
      result.current.register(entry2);

      result.current.navigateAbsolute('first', { filter: 'entryFocusable' });
      expect(entry1.focus).toHaveBeenCalled();
      expect(notEntry.focus).not.toHaveBeenCalled();
    });

    it('focuses last entryFocusable element with filter', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const entry1 = createMockElement('entry1', { entryFocusable: true });
      const entry2 = createMockElement('entry2', { entryFocusable: true });
      const notEntry = createMockElement('notEntry', { entryFocusable: false });

      appendToContainer(container, entry1);
      appendToContainer(container, entry2);
      appendToContainer(container, notEntry);
      result.current.register(entry1);
      result.current.register(entry2);
      result.current.register(notEntry);

      result.current.navigateAbsolute('last', { filter: 'entryFocusable' });
      expect(entry2.focus).toHaveBeenCalled();
      expect(notEntry.focus).not.toHaveBeenCalled();
    });

    it('falls back to first/last element if no entryFocusable found', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const notEntry1 = createMockElement('notEntry1', { entryFocusable: false });
      const notEntry2 = createMockElement('notEntry2', { entryFocusable: false });

      appendToContainer(container, notEntry1);
      appendToContainer(container, notEntry2);
      result.current.register(notEntry1);
      result.current.register(notEntry2);

      result.current.navigateAbsolute('first', { filter: 'entryFocusable' });
      expect(notEntry1.focus).toHaveBeenCalled();

      result.current.navigateAbsolute('last', { filter: 'entryFocusable' });
      expect(notEntry2.focus).toHaveBeenCalled();
    });

    it('does nothing when no elements registered', () => {
      const { result } = renderHook(() => useFocusRegistry());
      // Should not throw
      result.current.navigateAbsolute('first');
      result.current.navigateAbsolute('last');
    });
  });

  describe('navigateRelative', () => {
    it('focuses next element', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.navigateRelative('el1', 'next');
      expect(element2.focus).toHaveBeenCalledWith('start');
    });

    it('focuses previous element', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.navigateRelative('el2', 'prev');
      expect(element1.focus).toHaveBeenCalledWith('end');
    });

    it('focuses next with custom position', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.navigateRelative('el1', 'next', { position: 'end' });
      expect(element2.focus).toHaveBeenCalledWith('end');
    });

    it('focuses next entryFocusable element with filter', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, notEntry);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(notEntry);
      result.current.register(element2);

      result.current.navigateRelative('el1', 'next', { filter: 'entryFocusable' });
      expect(element2.focus).toHaveBeenCalled();
      expect(notEntry.focus).not.toHaveBeenCalled();
    });

    it('focuses previous entryFocusable element with filter', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, notEntry);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(notEntry);
      result.current.register(element2);

      result.current.navigateRelative('el2', 'prev', { filter: 'entryFocusable' });
      expect(element1.focus).toHaveBeenCalled();
      expect(notEntry.focus).not.toHaveBeenCalled();
    });

    it('calls onExitRight when navigating past last element', () => {
      const onExitRight = vi.fn();
      const { result } = renderHook(() => useFocusRegistry({ onExitRight }));
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.navigateRelative('el1', 'next');
      expect(onExitRight).toHaveBeenCalled();
    });

    it('calls onExitLeft when navigating before first element', () => {
      const onExitLeft = vi.fn();
      const { result } = renderHook(() => useFocusRegistry({ onExitLeft }));
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.navigateRelative('el1', 'prev');
      expect(onExitLeft).toHaveBeenCalled();
    });

    it('does nothing for unknown fromId', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      // Should not throw
      result.current.navigateRelative('unknown', 'next');
      expect(element.focus).not.toHaveBeenCalled();
    });
  });

  describe('backward compatibility wrappers', () => {
    it('focusFirst works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.focusFirst('start');
      expect(element.focus).toHaveBeenCalledWith('start');
    });

    it('focusLast works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      result.current.focusLast('end');
      expect(element.focus).toHaveBeenCalledWith('end');
    });

    it('focusFirstEntryFocusable works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const entry = createMockElement('entry');

      appendToContainer(container, notEntry);
      appendToContainer(container, entry);
      result.current.register(notEntry);
      result.current.register(entry);

      result.current.focusFirstEntryFocusable('start');
      expect(entry.focus).toHaveBeenCalledWith('start');
    });

    it('focusLastEntryFocusable works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const entry = createMockElement('entry');
      const notEntry = createMockElement('notEntry', { entryFocusable: false });

      appendToContainer(container, entry);
      appendToContainer(container, notEntry);
      result.current.register(entry);
      result.current.register(notEntry);

      result.current.focusLastEntryFocusable('end');
      expect(entry.focus).toHaveBeenCalledWith('end');
    });

    it('focusNext works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.focusNext('el1', 'end');
      expect(element2.focus).toHaveBeenCalledWith('end');
    });

    it('focusPrev works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      result.current.focusPrev('el2');
      expect(element1.focus).toHaveBeenCalledWith('end');
    });

    it('focusNextEntryFocusable works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, notEntry);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(notEntry);
      result.current.register(element2);

      result.current.focusNextEntryFocusable('el1');
      expect(element2.focus).toHaveBeenCalledWith('start');
    });

    it('focusPrevEntryFocusable works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const notEntry = createMockElement('notEntry', { entryFocusable: false });
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, notEntry);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(notEntry);
      result.current.register(element2);

      result.current.focusPrevEntryFocusable('el2');
      expect(element1.focus).toHaveBeenCalledWith('end');
    });

    it('focusById works', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element = createMockElement('el1');

      appendToContainer(container, element);
      result.current.register(element);

      const found = result.current.focusById('el1', 'start');
      expect(found).toBe(true);
      expect(element.focus).toHaveBeenCalledWith('start');
    });

    it('focusById returns false for unknown id', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const found = result.current.focusById('unknown');
      expect(found).toBe(false);
    });
  });

  describe('element availability', () => {
    it('only includes registered elements with valid refs', () => {
      const { result } = renderHook(() => useFocusRegistry());
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);
      result.current.register(element2);

      expect(result.current.getElements()).toHaveLength(2);

      // Simulate element removal from DOM (ref becomes null-like scenario)
      const unregister = result.current.register(element1);
      unregister();

      expect(result.current.getElements()).toHaveLength(1);
      expect(result.current.getElements()[0]?.id).toBe('el2');
    });
  });

  describe('Registry stability', () => {
    it('registry methods maintain stable reference across re-renders', () => {
      const { result, rerender } = renderHook(() => useFocusRegistry());

      const register1 = result.current.register;
      const navigateAbsolute1 = result.current.navigateAbsolute;
      const navigateRelative1 = result.current.navigateRelative;
      const focusFirst1 = result.current.focusFirst;
      const focusById1 = result.current.focusById;
      const getElements1 = result.current.getElements;

      rerender();

      // All methods should be stable across re-renders (memoized)
      expect(result.current.register).toBe(register1);
      expect(result.current.navigateAbsolute).toBe(navigateAbsolute1);
      expect(result.current.navigateRelative).toBe(navigateRelative1);
      expect(result.current.focusFirst).toBe(focusFirst1);
      expect(result.current.focusById).toBe(focusById1);
      expect(result.current.getElements).toBe(getElements1);
    });

    it('navigateRelative uses current elements even when called from stale closure', () => {
      const onExitRight = vi.fn();
      const { result } = renderHook(() => useFocusRegistry({ onExitRight }));
      const element1 = createMockElement('el1');
      const element2 = createMockElement('el2');

      appendToContainer(container, element1);
      appendToContainer(container, element2);
      result.current.register(element1);

      // Capture navigateRelative before adding second element
      const capturedNavigateRelative = result.current.navigateRelative;

      // Add second element after capture
      result.current.register(element2);

      // Call captured function - should still see second element
      capturedNavigateRelative('el1', 'next');

      // Should focus element2, not call onExitRight
      expect(element2.focus).toHaveBeenCalled();
      expect(onExitRight).not.toHaveBeenCalled();
    });

    it('registry works correctly when options change', () => {
      const onExitRight1 = vi.fn();
      const onExitRight2 = vi.fn();

      const { result, rerender } = renderHook(({ options }) => useFocusRegistry(options), {
        initialProps: { options: { onExitRight: onExitRight1 } },
      });

      const element = createMockElement('el1');
      appendToContainer(container, element);
      result.current.register(element);

      // Navigate past last element with first callback
      result.current.navigateRelative('el1', 'next');
      expect(onExitRight1).toHaveBeenCalledTimes(1);

      // Change options
      rerender({ options: { onExitRight: onExitRight2 } });

      // Navigate again - should call new callback
      result.current.navigateRelative('el1', 'next');
      expect(onExitRight1).toHaveBeenCalledTimes(1); // Still 1
      expect(onExitRight2).toHaveBeenCalledTimes(1); // New callback called
    });
  });
});
