import type { RefObject } from 'react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { TokenFocusEntry } from '../../plugins/token-focus';
import type { CursorPosition, FocusableBlock, FocusRegistry } from './contexts/token-focus-context';
import { useTokenFocusContext } from './contexts/token-focus-context';

function compareDomOrder(a: FocusableBlock, b: FocusableBlock): number {
  const aElement = a.element.current;
  const bElement = b.element.current;
  if (!aElement || !bElement) return 0;
  const position = aElement.compareDocumentPosition(bElement);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

interface FocusExits {
  onExitLeft: () => void;
  onExitRight: () => void;
}

function createFocusRegistry({ onExitLeft, onExitRight }: FocusExits): FocusRegistry {
  const blocks = new Map<string, FocusableBlock>();

  const inDomOrder = (): FocusableBlock[] =>
    [...blocks.values()].filter((block) => block.element.current !== null).sort(compareDomOrder);

  const edgeBlock = (edge: 'first' | 'last', entryOnly: boolean): FocusableBlock | undefined => {
    const all = inDomOrder();
    const entry = entryOnly ? all.filter((block) => block.entryFocusable !== false) : all;
    // A token without an entry-focusable block still enters at one of its blocks
    const candidates = entry.length > 0 ? entry : all;
    return edge === 'first' ? candidates[0] : candidates[candidates.length - 1];
  };

  return {
    register: (block) => {
      blocks.set(block.id, block);
      return () => {
        blocks.delete(block.id);
      };
    },

    get: (id) => blocks.get(id),

    edge: (edge, { entryOnly = false } = {}) => edgeBlock(edge, entryOnly),

    focusEdge: (edge, { entryOnly = false, position } = {}) => {
      edgeBlock(edge, entryOnly)?.focus(position);
    },

    focusAdjacent: (fromId, direction, { entryOnly = false, position } = {}) => {
      const all = inDomOrder();
      const index = all.findIndex((block) => block.id === fromId);
      if (index === -1) return;

      const forward = direction === 'next';
      const beyond = forward ? all.slice(index + 1) : all.slice(0, index).reverse();
      const target = beyond.find((block) => !entryOnly || block.entryFocusable !== false);
      if (target) {
        target.focus(position ?? (forward ? 'start' : 'end'));
        return;
      }
      if (forward) onExitRight();
      else onExitLeft();
    },
  };
}

/**
 * The blocks of a token, by id, in DOM order. The registry is rebuilt only when the
 * callbacks that leave the token change, which a token's own never do.
 */
export function useFocusRegistry(exits: FocusExits): FocusRegistry {
  const { onExitLeft, onExitRight } = exits;
  return useMemo(() => createFocusRegistry({ onExitLeft, onExitRight }), [onExitLeft, onExitRight]);
}

/**
 * The block that `entry` enters the token at. A keyboard entry at the end comes from the
 * right, so it is the last such block; every other entry takes the first.
 */
export function entryBlock(
  registry: FocusRegistry,
  entry: TokenFocusEntry
): FocusableBlock | undefined {
  const fromRight = entry.source === 'keyboard' && entry.position === 'end';
  return registry.edge(fromRight ? 'last' : 'first', { entryOnly: entry.target !== 'entry' });
}

export function focusEntryBlock(registry: FocusRegistry, entry: TokenFocusEntry): void {
  entryBlock(registry, entry)?.focus(entry.position);
}

export interface UseFocusableBlockOptions {
  id: string;
  ref: RefObject<HTMLElement | null>;
  handleKey: (e: React.KeyboardEvent) => boolean;
  activate?: () => void;
  focus?: (position?: CursorPosition) => void;
  /** Whether this block is available for focus navigation. Default: true */
  available?: boolean;
  /** Whether this block can receive focus when entering the token via Backspace/Delete. Default: true */
  entryFocusable?: boolean;
  editsToken?: boolean;
}

export interface UseFocusableBlockResult {
  /** Moves focus to the previous block (all blocks, for Arrow navigation) */
  navigateLeft: () => void;
  /** Moves focus to the next block (all blocks, for Arrow navigation) */
  navigateRight: (position?: CursorPosition) => void;
  /** Moves focus to the previous entry-focusable block (for Backspace navigation) */
  navigateLeftEntry: () => void;
  /** Moves focus to the next entry-focusable block (for Delete navigation) */
  navigateRightEntry: () => void;
  /** The block is the tab stop while it holds focus. */
  tabIndex: 0 | -1;
  /**
   * What the block's element needs to take part: the id by which a press on it is
   * recognised, and the record that it holds DOM focus, however focus got there.
   */
  blockProps: {
    'data-token-block': string;
    onFocus: () => void;
  };
}

function focusElement(element: HTMLElement, position?: CursorPosition): void {
  element.focus();
  if (!(element instanceof HTMLInputElement)) return;
  if (position === 'start') element.setSelectionRange(0, 0);
  else if (position === 'end')
    element.setSelectionRange(element.value.length, element.value.length);
}

/**
 * Registers a block of a token in its focus registry, together with the one function
 * that handles the keys pressed while the block holds focus, and gives the block the
 * means to move focus to its neighbours.
 */
export function useFocusableBlock(options: UseFocusableBlockOptions): UseFocusableBlockResult {
  const {
    id,
    ref,
    handleKey,
    activate,
    focus,
    available = true,
    entryFocusable,
    editsToken = true,
  } = options;
  const { focusRegistry, currentFocusId, setCurrentFocusId } = useTokenFocusContext();

  // The registered block calls the latest handlers, so new ones need no re-registration
  const handlersRef = useRef({ handleKey, activate });
  useLayoutEffect(() => {
    handlersRef.current = { handleKey, activate };
  });

  useLayoutEffect(() => {
    if (!available) return;

    return focusRegistry.register({
      id,
      element: ref,
      focus: (position) => {
        if (focus) focus(position);
        else if (ref.current) focusElement(ref.current, position);
        setCurrentFocusId(id);
      },
      handleKey: (e) => handlersRef.current.handleKey(e),
      activate: () => handlersRef.current.activate?.(),
      entryFocusable,
      editsToken,
    });
  }, [id, ref, focus, available, entryFocusable, editsToken, focusRegistry, setCurrentFocusId]);

  return {
    navigateLeft: () => focusRegistry.focusAdjacent(id, 'prev'),
    navigateRight: (position) => focusRegistry.focusAdjacent(id, 'next', { position }),
    navigateLeftEntry: () => focusRegistry.focusAdjacent(id, 'prev', { entryOnly: true }),
    navigateRightEntry: () => focusRegistry.focusAdjacent(id, 'next', { entryOnly: true }),
    tabIndex: currentFocusId === id ? 0 : -1,
    blockProps: {
      'data-token-block': id,
      onFocus: () => setCurrentFocusId(id),
    },
  };
}
