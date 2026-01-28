import { createContext, useContext, useEffect, useRef } from 'react';
import type { HandlerPriorityValue } from './priorities';

export type KeyboardHandler = (event: React.KeyboardEvent) => boolean | undefined;

export interface KeyboardHandlerConfig {
  handler: KeyboardHandler;
  priority: HandlerPriorityValue | number;
}

export type KeyboardHandlers = Record<string, KeyboardHandlerConfig>;

/** Getter function to retrieve current handlers (allows ref-based updates) */
export type HandlersGetter = () => KeyboardHandlers;

export interface KeyboardHandlersRegistry {
  register: (blockId: string, getHandlers: HandlersGetter) => () => void;
  /** Get handlers for a key, sorted by priority (high to low) */
  getHandlersForKey: (key: string) => Array<{ blockId: string; handler: KeyboardHandler }>;
}

export const KeyboardHandlersContext = createContext<KeyboardHandlersRegistry | null>(null);

/**
 * Creates a registry for keyboard handlers from blocks.
 * Used internally by Token component.
 *
 * Handlers are retrieved via getter functions to support ref-based updates
 * without requiring re-registration. This allows blocks to update their
 * handlers without triggering useEffect re-runs.
 *
 * Note: Cache is cleared on each getHandlersForKey call since handlers
 * can change via refs without re-registration.
 */
export function useKeyboardHandlersRegistry(): KeyboardHandlersRegistry {
  const registryRef = useRef<KeyboardHandlersRegistry | null>(null);
  const gettersRef = useRef<Map<string, HandlersGetter>>(new Map());

  // Create stable registry object once
  if (!registryRef.current) {
    registryRef.current = {
      register: (blockId: string, getHandlers: HandlersGetter): (() => void) => {
        gettersRef.current.set(blockId, getHandlers);
        return () => {
          gettersRef.current.delete(blockId);
        };
      },

      getHandlersForKey: (key: string): Array<{ blockId: string; handler: KeyboardHandler }> => {
        const result: Array<{ blockId: string; handler: KeyboardHandler; priority: number }> = [];
        for (const [blockId, getHandlers] of gettersRef.current) {
          const handlers = getHandlers();
          const config = handlers[key];
          if (config) {
            result.push({ blockId, handler: config.handler, priority: config.priority });
          }
        }
        result.sort((a, b) => b.priority - a.priority);
        return result.map(({ blockId, handler }) => ({ blockId, handler }));
      },
    };
  }

  return registryRef.current;
}

/**
 * Hook for blocks to contribute keyboard handlers to the Token.
 * Handlers are called before default Token keyboard handling.
 *
 * Uses ref-based pattern: handlers object can change without causing
 * re-registration. The registry retrieves current handlers via getter
 * at dispatch time, ensuring latest handler logic is always used.
 *
 * When a handler returns `true`, it indicates the event was fully handled
 * and no further processing should occur.
 */
export function useBlockKeyboardContribution(blockId: string, handlers: KeyboardHandlers): void {
  const registry = useContext(KeyboardHandlersContext);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!registry) return;
    // Register with getter function - handlers updates don't trigger re-registration
    return registry.register(blockId, () => handlersRef.current);
  }, [registry, blockId]);
}
