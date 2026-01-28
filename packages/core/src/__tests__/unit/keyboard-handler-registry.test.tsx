/**
 * Unit tests for Keyboard Handler Registry.
 *
 * Tests the keyboard handler contribution pattern used by Token blocks.
 * Focuses on handler registration, priority ordering, cache management,
 * and handler update behavior.
 */

import { renderHook } from '@testing-library/react';
import type { FC, PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HandlerPriority } from '../../tokens/composition/keyboard/priorities';
import {
  type KeyboardHandlers,
  KeyboardHandlersContext,
  useBlockKeyboardContribution,
  useKeyboardHandlersRegistry,
} from '../../tokens/composition/keyboard/use-keyboard-handlers';

function createMockHandler(returnValue: boolean | undefined = true) {
  return vi.fn(() => returnValue);
}

describe('useKeyboardHandlersRegistry', () => {
  describe('register', () => {
    it('registers handlers for a block', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler, priority: HandlerPriority.DEFAULT },
      }));

      const handlers = result.current.getHandlersForKey('Enter');
      expect(handlers).toHaveLength(1);
      expect(handlers[0]?.blockId).toBe('block1');
    });

    it('unregisters handlers when cleanup is called', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler = createMockHandler();

      const unregister = result.current.register('block1', () => ({
        Enter: { handler, priority: HandlerPriority.DEFAULT },
      }));

      expect(result.current.getHandlersForKey('Enter')).toHaveLength(1);

      unregister();

      expect(result.current.getHandlersForKey('Enter')).toHaveLength(0);
    });

    it('maintains handlers from multiple blocks', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));
      result.current.register('block2', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.DEFAULT },
      }));

      expect(result.current.getHandlersForKey('Enter')).toHaveLength(2);
    });
  });

  describe('handler updates', () => {
    it('updates handler reference when re-registered with same blockId', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));

      // Re-register with same blockId but different handler
      result.current.register('block1', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.DEFAULT },
      }));

      const handlers = result.current.getHandlersForKey('Enter');
      expect(handlers).toHaveLength(1);

      // Verify it's the new handler
      const mockEvent = {} as React.KeyboardEvent;
      handlers[0]?.handler(mockEvent);
      expect(handler2).toHaveBeenCalled();
      expect(handler1).not.toHaveBeenCalled();
    });

    it('retrieves latest handlers via getter on each call', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));

      // First call
      const cached1 = result.current.getHandlersForKey('Enter');

      // Register another block
      result.current.register('block2', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.VIEW },
      }));

      // Second call should include both handlers
      const cached2 = result.current.getHandlersForKey('Enter');

      expect(cached2).toHaveLength(2);
      expect(cached2).not.toBe(cached1);
    });

    it('reflects unregistration immediately', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      const unregister1 = result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));
      result.current.register('block2', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.DEFAULT },
      }));

      // First call
      result.current.getHandlersForKey('Enter');

      // Unregister first block
      unregister1();

      // Should only have one handler now
      expect(result.current.getHandlersForKey('Enter')).toHaveLength(1);
      expect(result.current.getHandlersForKey('Enter')[0]?.blockId).toBe('block2');
    });
  });

  describe('priority ordering', () => {
    it('sorts handlers by priority (high to low)', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const lowHandler = createMockHandler();
      const viewHandler = createMockHandler();
      const defaultHandler = createMockHandler();

      result.current.register('low', () => ({
        Enter: { handler: lowHandler, priority: -10 },
      }));
      result.current.register('view', () => ({
        Enter: { handler: viewHandler, priority: HandlerPriority.VIEW },
      }));
      result.current.register('default', () => ({
        Enter: { handler: defaultHandler, priority: HandlerPriority.DEFAULT },
      }));

      const handlers = result.current.getHandlersForKey('Enter');
      expect(handlers[0]?.blockId).toBe('view');
      expect(handlers[1]?.blockId).toBe('default');
      expect(handlers[2]?.blockId).toBe('low');
    });

    it('maintains order stability for same priority', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();
      const handler3 = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));
      result.current.register('block2', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.DEFAULT },
      }));
      result.current.register('block3', () => ({
        Enter: { handler: handler3, priority: HandlerPriority.DEFAULT },
      }));

      // Should be stable across multiple calls
      const handlers1 = result.current.getHandlersForKey('Enter');
      const handlers2 = result.current.getHandlersForKey('Enter');

      expect(handlers1.map((h) => h.blockId)).toEqual(handlers2.map((h) => h.blockId));
    });
  });

  describe('getHandlersForKey', () => {
    it('returns empty array for unregistered key', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());

      const handlers = result.current.getHandlersForKey('Enter');
      expect(handlers).toEqual([]);
    });

    it('only returns handlers for the specified key', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const enterHandler = createMockHandler();
      const escapeHandler = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler: enterHandler, priority: HandlerPriority.DEFAULT },
        Escape: { handler: escapeHandler, priority: HandlerPriority.DEFAULT },
      }));

      const enterHandlers = result.current.getHandlersForKey('Enter');
      const escapeHandlers = result.current.getHandlersForKey('Escape');
      const spaceHandlers = result.current.getHandlersForKey(' ');

      expect(enterHandlers).toHaveLength(1);
      expect(escapeHandlers).toHaveLength(1);
      expect(spaceHandlers).toHaveLength(0);
    });

    it('retrieves handlers fresh on each call (no caching due to ref-based updates)', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler = createMockHandler();

      result.current.register('block1', () => ({
        Enter: { handler, priority: HandlerPriority.DEFAULT },
      }));

      const handlers1 = result.current.getHandlersForKey('Enter');
      const handlers2 = result.current.getHandlersForKey('Enter');

      // Both should have same content but may be different arrays
      expect(handlers1).toHaveLength(1);
      expect(handlers2).toHaveLength(1);
      expect(handlers1[0]?.blockId).toBe(handlers2[0]?.blockId);
    });
  });

  describe('concurrent registration', () => {
    it('handles multiple blocks registering handlers simultaneously', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handlers: ReturnType<typeof createMockHandler>[] = [];

      // Simulate rapid registration from multiple blocks
      for (let i = 0; i < 10; i++) {
        const handler = createMockHandler();
        handlers.push(handler);
        result.current.register(`block${i}`, () => ({
          Enter: { handler, priority: HandlerPriority.DEFAULT },
        }));
      }

      const registeredHandlers = result.current.getHandlersForKey('Enter');
      expect(registeredHandlers).toHaveLength(10);
    });

    it('handles interleaved register and unregister operations', () => {
      const { result } = renderHook(() => useKeyboardHandlersRegistry());
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();
      const handler3 = createMockHandler();

      const unregister1 = result.current.register('block1', () => ({
        Enter: { handler: handler1, priority: HandlerPriority.DEFAULT },
      }));
      result.current.register('block2', () => ({
        Enter: { handler: handler2, priority: HandlerPriority.DEFAULT },
      }));
      unregister1();
      result.current.register('block3', () => ({
        Enter: { handler: handler3, priority: HandlerPriority.DEFAULT },
      }));

      const handlers = result.current.getHandlersForKey('Enter');
      expect(handlers).toHaveLength(2);
      expect(handlers.map((h) => h.blockId).sort()).toEqual(['block2', 'block3']);
    });
  });

  describe('registry method stability', () => {
    it('register and getHandlersForKey maintain stable references', () => {
      const { result, rerender } = renderHook(() => useKeyboardHandlersRegistry());

      const register1 = result.current.register;
      const getHandlers1 = result.current.getHandlersForKey;

      rerender();

      // Methods should be stable across re-renders (memoized)
      expect(result.current.register).toBe(register1);
      expect(result.current.getHandlersForKey).toBe(getHandlers1);
    });
  });
});

describe('useBlockKeyboardContribution', () => {
  const createWrapper =
    (registry: ReturnType<typeof useKeyboardHandlersRegistry>): FC<PropsWithChildren> =>
    ({ children }) => (
      <KeyboardHandlersContext.Provider value={registry}>
        {children}
      </KeyboardHandlersContext.Provider>
    );

  it('registers handlers on mount', () => {
    const { result: registryResult } = renderHook(() => useKeyboardHandlersRegistry());
    const handler = createMockHandler();

    const { unmount } = renderHook(
      () =>
        useBlockKeyboardContribution('testBlock', {
          Enter: { handler, priority: HandlerPriority.DEFAULT },
        }),
      { wrapper: createWrapper(registryResult.current) }
    );

    expect(registryResult.current.getHandlersForKey('Enter')).toHaveLength(1);

    unmount();

    expect(registryResult.current.getHandlersForKey('Enter')).toHaveLength(0);
  });

  it('re-registers when handlers change', () => {
    const { result: registryResult } = renderHook(() => useKeyboardHandlersRegistry());
    const handler1 = createMockHandler();
    const handler2 = createMockHandler();

    // Create a component that allows handler updates
    const useTestHook = (handlers: KeyboardHandlers) => {
      useBlockKeyboardContribution('testBlock', handlers);
    };

    const { rerender } = renderHook(({ handlers }) => useTestHook(handlers), {
      wrapper: createWrapper(registryResult.current),
      initialProps: {
        handlers: { Enter: { handler: handler1, priority: HandlerPriority.DEFAULT } },
      },
    });

    // Initial registration
    let handlers = registryResult.current.getHandlersForKey('Enter');
    const mockEvent = {} as React.KeyboardEvent;
    handlers[0]?.handler(mockEvent);
    expect(handler1).toHaveBeenCalled();

    // Update handlers
    rerender({
      handlers: { Enter: { handler: handler2, priority: HandlerPriority.DEFAULT } },
    });

    // Should use new handler
    handlers = registryResult.current.getHandlersForKey('Enter');
    handlers[0]?.handler(mockEvent);
    expect(handler2).toHaveBeenCalled();
  });

  it('does nothing when context is not provided', () => {
    const handler = createMockHandler();

    // Should not throw when no context
    const { unmount } = renderHook(() =>
      useBlockKeyboardContribution('testBlock', {
        Enter: { handler, priority: HandlerPriority.DEFAULT },
      })
    );

    unmount();
    // No error means success
  });

  it('re-registers when blockId changes', () => {
    const { result: registryResult } = renderHook(() => useKeyboardHandlersRegistry());
    const handler = createMockHandler();

    const { rerender } = renderHook(
      ({ blockId }) =>
        useBlockKeyboardContribution(blockId, {
          Enter: { handler, priority: HandlerPriority.DEFAULT },
        }),
      {
        wrapper: createWrapper(registryResult.current),
        initialProps: { blockId: 'block1' },
      }
    );

    let handlers = registryResult.current.getHandlersForKey('Enter');
    expect(handlers[0]?.blockId).toBe('block1');

    rerender({ blockId: 'block2' });

    // Should have updated blockId (old one unregistered, new one registered)
    handlers = registryResult.current.getHandlersForKey('Enter');
    expect(handlers).toHaveLength(1);
    expect(handlers[0]?.blockId).toBe('block2');
  });
});
