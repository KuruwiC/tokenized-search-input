import { useEffect, useRef } from 'react';
import type {
  CursorPosition,
  FocusableElement,
  FocusDirection,
  FocusFilter,
  FocusRegistry,
  FocusTarget,
  NavigateOptions,
} from '../contexts';

function sortByDomOrder(elements: FocusableElement[]): FocusableElement[] {
  return [...elements].sort((a, b) => {
    const aEl = a.ref.current;
    const bEl = b.ref.current;
    if (!aEl || !bEl) return 0;
    const position = aEl.compareDocumentPosition(bEl);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function applyFocusFilter(elements: FocusableElement[], filter: FocusFilter): FocusableElement[] {
  if (filter === 'entryFocusable') {
    return elements.filter((el) => el.entryFocusable !== false);
  }
  return elements;
}

export interface UseFocusRegistryOptions {
  onExitLeft?: () => void;
  onExitRight?: () => void;
}

/**
 * Creates a stable focus registry for managing focusable elements within a Token.
 * Elements are automatically sorted by DOM order.
 *
 * The registry object is created once and remains stable across re-renders.
 * Options (onExitLeft, onExitRight) are accessed via refs to ensure navigation
 * methods always use the latest callbacks without causing Context updates.
 */
export function useFocusRegistry(options: UseFocusRegistryOptions = {}): FocusRegistry {
  const elementsRef = useRef<Map<string, FocusableElement>>(new Map());
  const optionsRef = useRef(options);
  const registryRef = useRef<FocusRegistry | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  if (!registryRef.current) {
    const getElements = (): FocusableElement[] => {
      const elements = Array.from(elementsRef.current.values());
      return sortByDomOrder(elements.filter((el) => el.ref.current !== null));
    };

    const navigateAbsolute = (target: FocusTarget, navOptions: NavigateOptions = {}) => {
      const { filter = 'all', position } = navOptions;
      const elements = getElements();
      if (elements.length === 0) return;

      const filteredElements = applyFocusFilter(elements, filter);
      const targetElements = filteredElements.length > 0 ? filteredElements : elements;

      const element =
        target === 'first' ? targetElements[0] : targetElements[targetElements.length - 1];

      element?.focus(position);
    };

    const navigateRelative = (
      fromId: string,
      direction: FocusDirection,
      navOptions: NavigateOptions = {}
    ) => {
      const { filter = 'all', position } = navOptions;
      const elements = getElements();
      const currentIndex = elements.findIndex((el) => el.id === fromId);

      if (currentIndex === -1) return;

      const isNext = direction === 'next';
      const defaultPosition: CursorPosition = isNext ? 'start' : 'end';
      const finalPosition = position ?? defaultPosition;

      if (filter === 'entryFocusable') {
        const searchElements = isNext
          ? elements.slice(currentIndex + 1)
          : elements.slice(0, currentIndex).reverse();

        const targetElement = searchElements.find((el) => el.entryFocusable !== false);

        if (targetElement) {
          targetElement.focus(finalPosition);
        } else {
          isNext ? optionsRef.current.onExitRight?.() : optionsRef.current.onExitLeft?.();
        }
      } else {
        const targetIndex = isNext ? currentIndex + 1 : currentIndex - 1;

        if (targetIndex >= 0 && targetIndex < elements.length) {
          elements[targetIndex]?.focus(finalPosition);
        } else {
          isNext ? optionsRef.current.onExitRight?.() : optionsRef.current.onExitLeft?.();
        }
      }
    };

    registryRef.current = {
      register: (element: FocusableElement): (() => void) => {
        elementsRef.current.set(element.id, element);
        return () => {
          elementsRef.current.delete(element.id);
        };
      },
      navigateAbsolute,
      navigateRelative,
      getElements,
      focusFirst: (position?: CursorPosition) => navigateAbsolute('first', { position }),
      focusLast: (position?: CursorPosition) => navigateAbsolute('last', { position }),
      focusFirstEntryFocusable: (position?: CursorPosition) =>
        navigateAbsolute('first', { filter: 'entryFocusable', position }),
      focusLastEntryFocusable: (position?: CursorPosition) =>
        navigateAbsolute('last', { filter: 'entryFocusable', position }),
      focusNext: (fromId: string, position: CursorPosition = 'start') =>
        navigateRelative(fromId, 'next', { position }),
      focusPrev: (fromId: string) => navigateRelative(fromId, 'prev', { position: 'end' }),
      focusNextEntryFocusable: (fromId: string) =>
        navigateRelative(fromId, 'next', { filter: 'entryFocusable', position: 'start' }),
      focusPrevEntryFocusable: (fromId: string) =>
        navigateRelative(fromId, 'prev', { filter: 'entryFocusable', position: 'end' }),
      focusById: (id: string, position?: CursorPosition) => {
        const element = elementsRef.current.get(id);
        if (element?.ref.current) {
          element.focus(position);
          return true;
        }
        return false;
      },
    };
  }

  return registryRef.current;
}
