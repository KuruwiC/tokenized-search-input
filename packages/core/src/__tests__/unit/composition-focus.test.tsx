/**
 * Unit tests for the focus registry of a token and for the blocks that register in it.
 *
 * The registry is a map of blocks in DOM order; each block carries the one function that
 * handles the keys pressed while it holds focus.
 */

import { act, renderHook } from '@testing-library/react';
import type { FC, PropsWithChildren } from 'react';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { TokenFocusEntry } from '../../plugins/token-focus';
import {
  type CursorPosition,
  type FocusableBlock,
  type FocusRegistry,
  TokenFocusContext,
  type TokenFocusContextValue,
} from '../../tokens/composition/contexts/token-focus-context';
import {
  focusEntryBlock,
  useFocusableBlock,
  useFocusRegistry,
} from '../../tokens/composition/focus';

type MockBlock = FocusableBlock & {
  element: { current: HTMLDivElement };
  focus: Mock<(position?: CursorPosition) => void>;
};

function createBlock(
  id: string,
  options: { entryFocusable?: boolean; handleKey?: FocusableBlock['handleKey'] } = {}
): MockBlock {
  const element = document.createElement('div');
  return {
    id,
    element: { current: element },
    focus: vi.fn<(position?: CursorPosition) => void>(),
    handleKey: options.handleKey ?? (() => false),
    entryFocusable: options.entryFocusable ?? true,
    editsToken: true,
  };
}

const exits = () => ({ onExitLeft: vi.fn(), onExitRight: vi.fn() });

describe('useFocusRegistry', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  /** Registers the blocks in the given order after putting their elements in `container`. */
  function setup(blocks: MockBlock[], registerOrder: MockBlock[] = blocks) {
    const callbacks = exits();
    const { result } = renderHook(() => useFocusRegistry(callbacks));
    for (const block of blocks) container.appendChild(block.element.current);
    for (const block of registerOrder) result.current.register(block);
    return { registry: result.current, ...callbacks };
  }

  describe('register', () => {
    it('finds a registered block by id and forgets it when unregistered', () => {
      const block = createBlock('value');
      const { registry } = setup([]);

      const unregister = registry.register(block);
      expect(registry.get('value')).toBe(block);

      unregister();
      expect(registry.get('value')).toBeUndefined();
    });

    it('hands out the block with the key handler it registered', () => {
      const handleKey = vi.fn(() => true);
      const { registry } = setup([createBlock('value', { handleKey })]);

      const event = {} as React.KeyboardEvent;
      expect(registry.get('value')?.handleKey(event)).toBe(true);
      expect(handleKey).toHaveBeenCalledWith(event);
    });
  });

  describe('focusEdge', () => {
    it('focuses the first and the last block in DOM order, whatever the order of registration', () => {
      const [label, operator, value] = [
        createBlock('label'),
        createBlock('operator'),
        createBlock('value'),
      ];
      const { registry } = setup([label, operator, value], [value, label, operator]);

      registry.focusEdge('first');
      registry.focusEdge('last');

      expect(label.focus).toHaveBeenCalledTimes(1);
      expect(value.focus).toHaveBeenCalledTimes(1);
      expect(operator.focus).not.toHaveBeenCalled();
    });

    it('passes the position on to the block', () => {
      const block = createBlock('value');
      const { registry } = setup([block]);

      registry.focusEdge('first', { position: 'start' });

      expect(block.focus).toHaveBeenCalledWith('start');
    });

    it('skips blocks that cannot be entered when asked for entry-focusable ones', () => {
      const label = createBlock('label', { entryFocusable: false });
      const value = createBlock('value');
      const remove = createBlock('delete', { entryFocusable: false });
      const { registry } = setup([label, value, remove]);

      registry.focusEdge('first', { entryOnly: true });
      registry.focusEdge('last', { entryOnly: true });

      expect(value.focus).toHaveBeenCalledTimes(2);
      expect(label.focus).not.toHaveBeenCalled();
      expect(remove.focus).not.toHaveBeenCalled();
    });

    it('falls back to the edge block when none is entry-focusable', () => {
      const label = createBlock('label', { entryFocusable: false });
      const remove = createBlock('delete', { entryFocusable: false });
      const { registry } = setup([label, remove]);

      registry.focusEdge('first', { entryOnly: true });

      expect(label.focus).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no block is registered', () => {
      const { registry, onExitLeft, onExitRight } = setup([]);

      expect(() => registry.focusEdge('first')).not.toThrow();
      expect(onExitLeft).not.toHaveBeenCalled();
      expect(onExitRight).not.toHaveBeenCalled();
    });

    it('ignores blocks whose element is gone', () => {
      const gone = createBlock('label');
      const value = createBlock('value');
      const { registry } = setup([gone, value]);
      (gone.element as { current: HTMLDivElement | null }).current = null;

      registry.focusEdge('first');

      expect(value.focus).toHaveBeenCalledTimes(1);
      expect(gone.focus).not.toHaveBeenCalled();
    });
  });

  describe('focusAdjacent', () => {
    it('focuses the next block at its start and the previous one at its end', () => {
      const [label, operator, value] = [
        createBlock('label'),
        createBlock('operator'),
        createBlock('value'),
      ];
      const { registry } = setup([label, operator, value]);

      registry.focusAdjacent('operator', 'next');
      registry.focusAdjacent('operator', 'prev');

      expect(value.focus).toHaveBeenCalledWith('start');
      expect(label.focus).toHaveBeenCalledWith('end');
    });

    it('takes the position it is given', () => {
      const [operator, value] = [createBlock('operator'), createBlock('value')];
      const { registry } = setup([operator, value]);

      registry.focusAdjacent('operator', 'next', { position: 'end' });

      expect(value.focus).toHaveBeenCalledWith('end');
    });

    it('passes over blocks that cannot be entered when asked for entry-focusable ones', () => {
      const [label, operator, value, remove] = [
        createBlock('label', { entryFocusable: false }),
        createBlock('operator', { entryFocusable: false }),
        createBlock('value'),
        createBlock('delete', { entryFocusable: false }),
      ];
      const { registry } = setup([label, operator, value, remove]);

      registry.focusAdjacent('label', 'next', { entryOnly: true });
      registry.focusAdjacent('delete', 'prev', { entryOnly: true });

      expect(value.focus).toHaveBeenCalledTimes(2);
      expect(operator.focus).not.toHaveBeenCalled();
    });

    it('leaves the token to the right past the last block and to the left before the first', () => {
      const [label, value] = [createBlock('label'), createBlock('value')];
      const { registry, onExitLeft, onExitRight } = setup([label, value]);

      registry.focusAdjacent('value', 'next');
      expect(onExitRight).toHaveBeenCalledTimes(1);
      expect(onExitLeft).not.toHaveBeenCalled();

      registry.focusAdjacent('label', 'prev');
      expect(onExitLeft).toHaveBeenCalledTimes(1);
    });

    it('leaves the token when only blocks that cannot be entered lie ahead', () => {
      const [value, remove] = [
        createBlock('value'),
        createBlock('delete', { entryFocusable: false }),
      ];
      const { registry, onExitRight } = setup([value, remove]);

      registry.focusAdjacent('value', 'next', { entryOnly: true });

      expect(onExitRight).toHaveBeenCalledTimes(1);
      expect(remove.focus).not.toHaveBeenCalled();
    });

    it('does nothing for an unknown block', () => {
      const value = createBlock('value');
      const { registry, onExitLeft, onExitRight } = setup([value]);

      registry.focusAdjacent('missing', 'next');

      expect(value.focus).not.toHaveBeenCalled();
      expect(onExitLeft).not.toHaveBeenCalled();
      expect(onExitRight).not.toHaveBeenCalled();
    });

    it('sees blocks registered after it was handed out', () => {
      const [operator, value] = [createBlock('operator'), createBlock('value')];
      const { registry, onExitRight } = setup([operator]);
      const focusAdjacent = registry.focusAdjacent;

      container.appendChild(value.element.current);
      registry.register(value);
      focusAdjacent('operator', 'next');

      expect(value.focus).toHaveBeenCalledTimes(1);
      expect(onExitRight).not.toHaveBeenCalled();
    });
  });

  describe('stability', () => {
    it('keeps the registry across re-renders while the callbacks stay the same', () => {
      const callbacks = exits();
      const { result, rerender } = renderHook(() => useFocusRegistry(callbacks));
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });

    it('leaves through the latest callbacks', () => {
      const first = exits();
      const second = exits();
      const { result, rerender } = renderHook(({ callbacks }) => useFocusRegistry(callbacks), {
        initialProps: { callbacks: first },
      });
      const block = createBlock('value');
      container.appendChild(block.element.current);

      rerender({ callbacks: second });
      result.current.register(block);
      result.current.focusAdjacent('value', 'next');

      expect(first.onExitRight).not.toHaveBeenCalled();
      expect(second.onExitRight).toHaveBeenCalledTimes(1);
    });
  });
});

describe('focusEntryBlock', () => {
  function entry(overrides: Partial<TokenFocusEntry>): TokenFocusEntry {
    return { source: 'click', position: 'end', target: 'all', ...overrides };
  }

  function registryWith(blocks: MockBlock[]): FocusRegistry {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { result } = renderHook(() => useFocusRegistry(exits()));
    for (const block of blocks) {
      container.appendChild(block.element.current);
      result.current.register(block);
    }
    return result.current;
  }

  function blocks() {
    return [
      createBlock('label', { entryFocusable: false }),
      createBlock('value'),
      createBlock('delete', { entryFocusable: false }),
    ] as const;
  }

  it('enters a token that is edited as a whole at its first entry-focusable block', () => {
    const [label, value, remove] = blocks();
    focusEntryBlock(registryWith([label, value, remove]), entry({ source: 'program' }));

    expect(value.focus).toHaveBeenCalledWith('end');
    expect(label.focus).not.toHaveBeenCalled();
  });

  it('enters from the right at the last block that counts', () => {
    const [label, value, remove] = blocks();
    focusEntryBlock(
      registryWith([label, value, remove]),
      entry({ source: 'keyboard', position: 'end', target: 'entry' })
    );

    expect(remove.focus).toHaveBeenCalledWith('end');
  });

  it('enters from the left at the first block that counts', () => {
    const [label, value, remove] = blocks();
    focusEntryBlock(
      registryWith([label, value, remove]),
      entry({ source: 'keyboard', position: 'start', target: 'entry' })
    );

    expect(label.focus).toHaveBeenCalledWith('start');
  });
});

describe('useFocusableBlock', () => {
  function renderBlock(handleKey: (e: React.KeyboardEvent) => boolean, available = true) {
    const ref = { current: document.createElement('input') };
    const callbacks = exits();
    let registry: FocusRegistry | undefined;

    const Wrapper: FC<PropsWithChildren> = ({ children }) => {
      const focusRegistry = useFocusRegistry(callbacks);
      const [currentFocusId, setCurrentFocusId] = useState<string | null>(null);
      registry = focusRegistry;
      const value: TokenFocusContextValue = useMemo(
        () => ({
          showsControls: true,
          focusRegistry,
          currentFocusId,
          setCurrentFocusId,
          exitToken: vi.fn(),
          isEditable: true,
        }),
        [focusRegistry, currentFocusId]
      );
      return <TokenFocusContext.Provider value={value}>{children}</TokenFocusContext.Provider>;
    };

    const rendered = renderHook(
      (props: { handleKey: (e: React.KeyboardEvent) => boolean; available?: boolean }) =>
        useFocusableBlock({ id: 'value', ref, ...props }),
      { wrapper: Wrapper, initialProps: { handleKey, available } }
    );
    return { ...rendered, ref, getRegistry: () => registry as FocusRegistry };
  }

  it('registers the block and unregisters it on unmount', () => {
    const { getRegistry, unmount } = renderBlock(() => false);
    expect(getRegistry().get('value')).toBeDefined();

    unmount();

    expect(getRegistry().get('value')).toBeUndefined();
  });

  it('does not register an unavailable block', () => {
    const { getRegistry } = renderBlock(() => false, false);

    expect(getRegistry().get('value')).toBeUndefined();
  });

  it('registers a block once it becomes available', () => {
    const { getRegistry, rerender } = renderBlock(() => false, false);

    rerender({ handleKey: () => false, available: true });

    expect(getRegistry().get('value')).toBeDefined();
  });

  it('calls the latest key handler without registering again', () => {
    const first = vi.fn(() => false);
    const second = vi.fn(() => true);
    const { rerender, getRegistry } = renderBlock(first);
    const registered = getRegistry().get('value');

    rerender({ handleKey: second, available: true });
    const event = {} as React.KeyboardEvent;
    const handled = getRegistry().get('value')?.handleKey(event);

    expect(getRegistry().get('value')).toBe(registered);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(event);
    expect(handled).toBe(true);
  });

  it('becomes the tab stop once it holds focus', () => {
    const { result } = renderBlock(() => false);
    expect(result.current.tabIndex).toBe(-1);

    act(() => result.current.blockProps.onFocus());

    expect(result.current.tabIndex).toBe(0);
  });

  it('focuses its element, with the caret where asked, and becomes the tab stop', () => {
    const { result, ref, getRegistry } = renderBlock(() => false);
    document.body.appendChild(ref.current);
    ref.current.value = 'abc';

    act(() => getRegistry().get('value')?.focus('start'));

    expect(document.activeElement).toBe(ref.current);
    expect(ref.current.selectionStart).toBe(0);
    expect(ref.current.selectionEnd).toBe(0);
    expect(result.current.tabIndex).toBe(0);
    ref.current.remove();
  });
});
