import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  dismissSuggestion,
  getSuggestionState,
  isSuggestionOpen,
  type SuggestionType,
} from '../../plugins/suggestion-plugin';
import {
  getTokenFocusState,
  isTokenEntry,
  type CursorPosition as PluginCursorPosition,
  setTokenFocus,
} from '../../plugins/token-focus-plugin';
import { getDismissPolicy } from '../../suggestions/dismiss-policy';
import { cn } from '../../utils/cn';
import { isSpacer } from '../../utils/node-predicates';
import { TokenDeleteButton } from './blocks/token-delete-button';
import { TokenLabel } from './blocks/token-label';
import { TokenOperator } from './blocks/token-operator';
import { TokenValue } from './blocks/token-value';
import {
  type FocusRegistry,
  TokenConfigContext,
  type TokenConfigContextValue,
  TokenFocusContext,
  type TokenFocusContextValue,
} from './contexts';
import {
  createInitialState,
  executePendingFocus,
  getCurrentFocusId,
  getEntryDirection,
  getPendingFocus,
  isFocused as isFocusedState,
  type TokenEntry,
  tokenFocusReducer,
  useFocusRegistry,
} from './focus';
import { KeyboardHandlersContext, useKeyboardHandlersRegistry } from './keyboard';

interface ClickContext {
  event: React.MouseEvent;
  editor: Editor;
  getPos: () => number | undefined;
  isFocused: boolean;
  immutable: boolean;
  focusRegistry: FocusRegistry;
  handleActivate: () => void;
}

interface ClickStrategy {
  canHandle: (ctx: ClickContext) => boolean;
  execute: (ctx: ClickContext) => void;
}

const shiftClickStrategy: ClickStrategy = {
  canHandle: (ctx) => ctx.event.shiftKey,
  execute: () => {
    // Shift+click range selection is handled by selection-guard-plugin at mousedown.
    // Do nothing here - just return early.
  },
};

const immutableTokenStrategy: ClickStrategy = {
  canHandle: (ctx) => ctx.immutable,
  execute: (ctx) => {
    ctx.event.preventDefault();

    // DeleteButton click - let it handle itself
    const target = ctx.event.target as Element;
    if (target.closest('[data-token-delete-button]')) return;

    const pos = ctx.getPos();
    if (typeof pos !== 'number') return;

    const tokenNode = ctx.editor.state.doc.nodeAt(pos);
    if (!tokenNode) return;

    ctx.editor.view.focus();
    const tr = ctx.editor.state.tr;
    const tokenEnd = pos + tokenNode.nodeSize;
    tr.setSelection(TextSelection.create(tr.doc, pos, tokenEnd));
    tr.setMeta('addToHistory', false);
    ctx.editor.view.dispatch(tr);
  },
};

const inputElementStrategy: ClickStrategy = {
  canHandle: (ctx) => ctx.event.target instanceof HTMLInputElement,
  execute: (ctx) => {
    // Let the browser handle selection naturally (e.g., double-click word selection)
    // Still activate if not focused
    if (!ctx.isFocused) {
      ctx.handleActivate();
    }
  },
};

const focusedTokenStrategy: ClickStrategy = {
  canHandle: (ctx) => ctx.isFocused,
  execute: (ctx) => {
    const target = ctx.event.target as Element;
    const elements = ctx.focusRegistry.getElements();
    const clickedElement = elements.find((el) => el.ref.current?.contains(target));

    if (clickedElement) {
      clickedElement.focus('end');
      return;
    }

    // Clicked outside registered blocks (e.g., label): focus first entry-focusable
    ctx.focusRegistry.focusFirstEntryFocusable('end');
  },
};

const defaultActivateStrategy: ClickStrategy = {
  canHandle: () => true,
  execute: (ctx) => {
    ctx.handleActivate();
  },
};

const clickStrategies: ClickStrategy[] = [
  shiftClickStrategy,
  immutableTokenStrategy,
  inputElementStrategy,
  focusedTokenStrategy,
  defaultActivateStrategy,
];

function executeClickStrategy(ctx: ClickContext): void {
  const strategy = clickStrategies.find((s) => s.canHandle(ctx));
  strategy?.execute(ctx);
}

export interface TokenProps {
  editor: Editor;
  getPos: () => number | undefined;
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  invalid?: boolean;
  dataAttrs?: Record<string, string>;
  validate?: (value: string) => boolean | string;
  onInvalidChange?: (invalid: boolean) => void;
  /** Make token immutable (only deletable via X button or 2-stage Backspace). Default: false */
  immutable?: boolean;
}

/**
 * Exit token to the right and clear focus.
 *
 * @param editor - The editor instance
 * @param afterTokenPos - Position right after the token
 * @param existingTr - Optional existing transaction to append to (for atomic operations)
 */
export function exitTokenRight(
  editor: Editor,
  afterTokenPos: number,
  existingTr?: Transaction
): void {
  const tr = existingTr ?? editor.state.tr;
  const $pos = tr.doc.resolve(afterTokenPos);
  const nodeAfter = $pos.nodeAfter;

  setTokenFocus(tr, { focusedPos: null });
  tr.setMeta('exitingToken', true);

  // Only set addToHistory: false for standalone transactions
  // When existingTr is passed, the caller controls history behavior
  if (!existingTr) {
    tr.setMeta('addToHistory', false);
  }

  const hasSpacer = nodeAfter != null && isSpacer(nodeAfter);
  const cursorPos = hasSpacer ? afterTokenPos + nodeAfter.nodeSize : afterTokenPos;
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));

  editor.view.dispatch(tr);
  editor.view.focus();
}

function exitTokenLeft(editor: Editor, beforeTokenPos: number): void {
  const { state } = editor;
  const $pos = state.doc.resolve(beforeTokenPos);
  const nodeBefore = $pos.nodeBefore;

  const tr = state.tr;
  setTokenFocus(tr, { focusedPos: null });
  tr.setMeta('exitingToken', true);
  tr.setMeta('addToHistory', false);

  let cursorPos = beforeTokenPos;
  if (nodeBefore != null && isSpacer(nodeBefore)) {
    cursorPos = beforeTokenPos - nodeBefore.nodeSize;
  }

  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  editor.view.dispatch(tr);
  editor.view.focus();
}

function toTokenEntry(cursorPosition: PluginCursorPosition): TokenEntry {
  if (isTokenEntry(cursorPosition)) {
    const { direction, policy } = cursorPosition;
    return { direction, policy };
  }
  return { type: 'click' };
}

/**
 * Token container component using Compound Components pattern.
 * Manages focus, keyboard navigation, and provides context to child blocks.
 *
 * Uses a state machine (tokenFocusReducer) to manage focus state transitions,
 * consolidating previously separate state variables (isFocused, currentFocusId,
 * entryDirection, pendingFocus) into a single discriminated union.
 */
export function Token({
  editor,
  getPos,
  node,
  updateAttributes,
  deleteNode,
  children,
  className = '',
  ariaLabel,
  invalid = false,
  dataAttrs,
  validate,
  onInvalidChange,
  immutable = false,
}: TokenProps): React.ReactElement {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [focusState, dispatch] = useReducer(tokenFocusReducer, undefined, createInitialState);

  // Derive values from state machine
  const isFocused = isFocusedState(focusState);
  const currentFocusId = getCurrentFocusId(focusState);
  const entryDirection = getEntryDirection(focusState);
  const pendingFocus = getPendingFocus(focusState);

  const handleExitLeft = useCallback(() => {
    const pos = getPos();
    if (typeof pos === 'number') {
      dispatch({ type: 'EXIT_REQUESTED', direction: 'left' });
      exitTokenLeft(editor, pos);
      dispatch({ type: 'EXIT_COMPLETED' });
    }
  }, [editor, getPos]);

  const handleExitRight = useCallback(() => {
    const pos = getPos();
    if (typeof pos === 'number') {
      dispatch({ type: 'EXIT_REQUESTED', direction: 'right' });
      exitTokenRight(editor, pos + node.nodeSize);
      dispatch({ type: 'EXIT_COMPLETED' });
    }
  }, [editor, getPos, node.nodeSize]);

  const focusRegistry = useFocusRegistry({
    onExitLeft: handleExitLeft,
    onExitRight: handleExitRight,
  });

  const keyboardHandlersRegistry = useKeyboardHandlersRegistry();

  // setFocus callback for context - dispatches appropriate action
  const setFocus = useCallback((focused: boolean) => {
    if (!focused) {
      dispatch({ type: 'PLUGIN_FOCUS_LOST' });
    }
  }, []);

  // setCurrentFocusId callback for context - dispatches CHILD_FOCUSED
  const setCurrentFocusIdCallback = useCallback((id: string | null) => {
    if (id !== null) {
      dispatch({ type: 'CHILD_FOCUSED', id });
    }
  }, []);

  // Listen to token focus plugin state
  useEffect(() => {
    const checkFocus = () => {
      const pos = getPos();
      const pluginFocusState = getTokenFocusState(editor.state);

      if (typeof pos === 'number' && pluginFocusState?.focusedPos === pos) {
        // This token should be focused
        if (!isFocused) {
          const entry = toTokenEntry(pluginFocusState.cursorPosition);
          dispatch({ type: 'PLUGIN_FOCUS_GAINED', entry });
        }
      } else if (pluginFocusState?.focusedPos !== pos && isFocused) {
        // This token lost focus
        dispatch({ type: 'PLUGIN_FOCUS_LOST' });
      }
    };

    checkFocus();
    editor.on('transaction', checkFocus);
    return () => {
      editor.off('transaction', checkFocus);
    };
  }, [editor, getPos, isFocused]);

  // Execute pending focus after render (when input is available)
  useEffect(() => {
    if (!pendingFocus) return;
    // Skip if editor became disabled while waiting
    if (!editor.isEditable) {
      dispatch({ type: 'EDITOR_DISABLED' });
      return;
    }

    // Use setTimeout(0) to ensure DOM is updated and work in test environments
    const timeoutId = setTimeout(() => {
      // Re-check isEditable in case it changed during the timeout
      if (!editor.isEditable) {
        dispatch({ type: 'EDITOR_DISABLED' });
        return;
      }

      // Execute the appropriate focus method
      executePendingFocus(focusRegistry, pendingFocus);

      // Mark pending focus as executed - the CHILD_FOCUSED action will be
      // dispatched when the child element actually receives focus
      dispatch({ type: 'PENDING_FOCUS_EXECUTED', focusId: 'pending' });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [pendingFocus, focusRegistry, editor.isEditable]);

  // Handle container activation
  const handleActivate = useCallback(() => {
    if (!isFocused) {
      const pos = getPos();
      if (typeof pos === 'number') {
        // Ensure editor has DOM focus before activating token.
        // ProseMirror expects to own focus when mutating selection/cursor.
        // This is critical for mobile browsers where programmatic focus
        // operations fail without prior DOM focus establishment.
        editor.view.focus();

        const tr = editor.state.tr;
        setTokenFocus(tr, { focusedPos: pos, cursorPosition: 'end' });
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      }
    } else {
      // Already focused - restore focus to the entry element (e.g., input)
      // This prevents caret from disappearing when re-tapping on mobile
      focusRegistry.focusFirstEntryFocusable('end');
    }
  }, [editor, getPos, isFocused, focusRegistry]);

  // Desktop click handler (React synthetic event)
  // Note: When disabled, pointer-events-none on EditorContent prevents this from firing
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      executeClickStrategy({
        event: e,
        editor,
        getPos,
        isFocused,
        immutable,
        focusRegistry,
        handleActivate,
      });
    },
    [editor, handleActivate, isFocused, focusRegistry, immutable, getPos]
  );

  // Handle container focus (keyboard navigation)
  const handleContainerFocus = useCallback(
    (e: React.FocusEvent) => {
      // Prevent focus handling when editor is disabled
      if (!editor.isEditable) return;

      if (e.target === containerRef.current && !isFocused) {
        const pos = getPos();
        if (typeof pos === 'number') {
          const tr = editor.state.tr;
          setTokenFocus(tr, { focusedPos: pos, cursorPosition: 'end' });
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
        }
      }
    },
    [editor, getPos, isFocused]
  );

  // Handle blur
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Check if focus moved outside the container
      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget && container.contains(relatedTarget)) {
        return;
      }

      // Check if a picker requiring explicit confirm is open - preserve token focus
      // The picker is rendered outside the token container but still belongs to this token's editing session
      const suggestionState = getSuggestionState(editor.state);
      if (isSuggestionOpen(suggestionState)) {
        const policy = getDismissPolicy(suggestionState.type as SuggestionType);
        // Pickers with explicit confirm (date/datetime) need to preserve token focus
        // Other suggestions use focusin-based dismiss via useDismissManager
        if (policy.requireExplicitConfirm) {
          return;
        }
      }

      // Validate on blur if validation is provided
      if (validate) {
        const elements = focusRegistry.getElements();
        const valueElement = elements.find((el) => el.id === 'value');
        if (valueElement?.ref.current instanceof HTMLInputElement) {
          const currentValue = valueElement.ref.current.value;
          const result = validate(currentValue);
          // validate returns true for valid, false or error string for invalid
          const isValid = result === true;
          onInvalidChange?.(!isValid);
        }
      }

      // Dispatch focus lost action
      dispatch({ type: 'PLUGIN_FOCUS_LOST' });

      const pos = getPos();
      if (typeof pos === 'number') {
        const tr = editor.state.tr;
        setTokenFocus(tr, { focusedPos: null });
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      }
    },
    [editor, getPos, validate, onInvalidChange, focusRegistry]
  );

  // Centralized keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Prevent keyboard handling when editor is disabled
      if (!editor.isEditable) return;

      // First, let blocks handle the event (sorted by priority)
      const sortedHandlers = keyboardHandlersRegistry.getHandlersForKey(e.key);
      for (const { handler } of sortedHandlers) {
        const result = handler(e);
        if (result === true) return;
      }

      // Token-level keyboard handling
      // ESC: two-stage behavior (Gmail/Slack pattern)
      // 1st ESC: close suggestions if open, stay in token
      // 2nd ESC: exit token to the right
      if (e.key === 'Escape') {
        e.preventDefault();

        const suggestionState = getSuggestionState(editor.state);
        if (isSuggestionOpen(suggestionState)) {
          const tr = editor.state.tr;
          dismissSuggestion(tr);
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
          return;
        }

        handleExitRight();
        return;
      }

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        handleExitRight();
        return;
      }

      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        handleExitLeft();
        return;
      }
    },
    [editor, keyboardHandlersRegistry, handleExitLeft, handleExitRight]
  );

  // Handle delete with focus restoration to editor
  const handleDelete = useCallback(() => {
    // Prevent deletion when editor is disabled
    if (!editor.isEditable) return;

    // Move DOM focus to editor BEFORE deletion.
    // This prevents browser from auto-focusing next tabbable element
    // (e.g., next token's close button) when the current token is removed.
    editor.view.focus();

    deleteNode();
  }, [deleteNode, editor]);

  // Wrapper for dispatchKeyDown that stops propagation to prevent double handling
  // (once from dispatchKeyDown call, once from event bubbling to NodeViewWrapper)
  const dispatchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e);
      e.stopPropagation();
    },
    [handleKeyDown]
  );

  // Context values (memoized to prevent unnecessary re-renders)
  const configContextValue: TokenConfigContextValue = useMemo(
    () => ({
      editor,
      getPos,
      node,
      updateAttributes,
      deleteToken: handleDelete,
    }),
    [editor, getPos, node, updateAttributes, handleDelete]
  );

  const focusContextValue: TokenFocusContextValue = useMemo(
    () => ({
      isFocused,
      setFocus,
      entryDirection,
      focusRegistry,
      currentFocusId,
      setCurrentFocusId: setCurrentFocusIdCallback,
      exitToken: handleExitRight,
      dispatchKeyDown,
      isEditable: editor.isEditable,
    }),
    [
      isFocused,
      setFocus,
      entryDirection,
      focusRegistry,
      currentFocusId,
      setCurrentFocusIdCallback,
      handleExitRight,
      dispatchKeyDown,
      editor.isEditable,
    ]
  );

  const wrapperClasses = 'tsi-token-wrapper';

  const tokenClasses = cn('tsi-token', className);

  // Compute aria-label based on state
  const computedAriaLabel = (() => {
    if (isFocused) {
      return `${ariaLabel}. Editing.`;
    }
    if (immutable && editor.isEditable) {
      return `${ariaLabel}. Immutable. Click X to delete.`;
    }
    if (editor.isEditable) {
      return `${ariaLabel}. Click to edit.`;
    }
    return `${ariaLabel}. Disabled.`;
  })();

  // Compute data-state based on state
  const dataState = isFocused ? 'editing' : 'idle';

  return (
    <NodeViewWrapper
      as="span"
      ref={containerRef}
      contentEditable={false}
      onClick={handleClick}
      onFocus={handleContainerFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={wrapperClasses}
      aria-label={computedAriaLabel}
      aria-disabled={!editor.isEditable || undefined}
      aria-readonly={immutable || undefined}
      role="group"
      tabIndex={-1}
    >
      <span
        className={tokenClasses}
        data-focused={isFocused}
        data-state={dataState}
        data-invalid={invalid}
        data-immutable={immutable}
        data-editable={editor.isEditable}
        {...dataAttrs}
      >
        <TokenConfigContext.Provider value={configContextValue}>
          <TokenFocusContext.Provider value={focusContextValue}>
            <KeyboardHandlersContext.Provider value={keyboardHandlersRegistry}>
              {children}
            </KeyboardHandlersContext.Provider>
          </TokenFocusContext.Provider>
        </TokenConfigContext.Provider>
      </span>
    </NodeViewWrapper>
  );
}

// Attach block components as static properties for Compound Components pattern
Token.Label = TokenLabel;
Token.Operator = TokenOperator;
Token.Value = TokenValue;
Token.DeleteButton = TokenDeleteButton;
