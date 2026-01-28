import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import {
  closeSuggestion,
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
import { TokenLabel, TokenLabelCombobox } from './blocks/token-label';
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
  execute: () => {},
};

const immutableTokenStrategy: ClickStrategy = {
  canHandle: (ctx) => ctx.immutable,
  execute: (ctx) => {
    ctx.event.preventDefault();

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
  /** Canonical value for validation (e.g., 'active' not 'アクティブ'). Falls back to input display value if not provided. */
  value?: string;
  validate?: (value: string) => boolean | string;
  onInvalidChange?: (invalid: boolean) => void;
  /** Callback when token loses focus (blur). Called after internal blur handling. */
  onBlur?: () => void;
  /** Make token immutable (only deletable via X button or 2-stage Backspace). Default: false */
  immutable?: boolean;
  /** Whether this token is part of a range selection */
  rangeSelected?: boolean;
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
  closeSuggestion(tr);
  tr.setMeta('exitingToken', true);

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
  closeSuggestion(tr);
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
  value,
  validate,
  onInvalidChange,
  onBlur: onBlurCallback,
  immutable = false,
  rangeSelected = false,
}: TokenProps): React.ReactElement {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [focusState, dispatch] = useReducer(tokenFocusReducer, undefined, createInitialState);
  // Ref to track exiting state synchronously (dispatch is async, but blur fires sync)
  const isExitingRef = useRef(false);

  const isFocused = isFocusedState(focusState);
  const currentFocusId = getCurrentFocusId(focusState);
  const entryDirection = getEntryDirection(focusState);
  const pendingFocus = getPendingFocus(focusState);

  const handleExitLeft = useCallback(() => {
    const pos = getPos();
    if (typeof pos === 'number') {
      isExitingRef.current = true;
      dispatch({ type: 'EXIT_REQUESTED', direction: 'left' });
      exitTokenLeft(editor, pos);
      dispatch({ type: 'EXIT_COMPLETED' });
    }
  }, [editor, getPos]);

  const handleExitRight = useCallback(() => {
    const pos = getPos();
    if (typeof pos === 'number') {
      isExitingRef.current = true;
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

  const setFocus = useCallback((focused: boolean) => {
    if (!focused) {
      dispatch({ type: 'PLUGIN_FOCUS_LOST' });
    }
  }, []);

  const setCurrentFocusIdCallback = useCallback((id: string | null) => {
    if (id !== null) {
      dispatch({ type: 'CHILD_FOCUSED', id });
    }
  }, []);

  useEffect(() => {
    const checkFocus = () => {
      const pos = getPos();
      const pluginFocusState = getTokenFocusState(editor.state);

      if (typeof pos === 'number' && pluginFocusState?.focusedPos === pos) {
        if (!isFocused) {
          const entry = toTokenEntry(pluginFocusState.cursorPosition);
          dispatch({ type: 'PLUGIN_FOCUS_GAINED', entry });
        }
      } else if (pluginFocusState?.focusedPos !== pos && isFocused) {
        dispatch({ type: 'PLUGIN_FOCUS_LOST' });
      }
    };

    checkFocus();
    editor.on('transaction', checkFocus);
    return () => {
      editor.off('transaction', checkFocus);
    };
  }, [editor, getPos, isFocused]);

  useLayoutEffect(() => {
    if (!pendingFocus) return;
    if (!editor.isEditable) {
      dispatch({ type: 'EDITOR_DISABLED' });
      return;
    }

    executePendingFocus(focusRegistry, pendingFocus);
    dispatch({ type: 'PENDING_FOCUS_EXECUTED', focusId: 'pending' });
  }, [pendingFocus, focusRegistry, editor.isEditable]);

  const handleActivate = useCallback(() => {
    if (!isFocused) {
      const pos = getPos();
      if (typeof pos === 'number') {
        editor.view.focus();
        const tr = editor.state.tr;
        setTokenFocus(tr, { focusedPos: pos, cursorPosition: 'end' });
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      }
    } else {
      focusRegistry.focusFirstEntryFocusable('end');
    }
  }, [editor, getPos, isFocused, focusRegistry]);

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

  const handleContainerFocus = useCallback(
    (e: React.FocusEvent) => {
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

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const wasExiting = isExitingRef.current;
      isExitingRef.current = false;

      if (wasExiting) {
        onBlurCallback?.();
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget && container.contains(relatedTarget)) {
        return;
      }

      const suggestionState = getSuggestionState(editor.state);
      if (isSuggestionOpen(suggestionState)) {
        const policy = getDismissPolicy(suggestionState.type as SuggestionType);
        if (policy.requireExplicitConfirm) {
          return;
        }
      }

      if (validate) {
        // Use canonical value prop if provided, otherwise fall back to input display value
        let valueToValidate: string | undefined;
        if (value !== undefined) {
          valueToValidate = value;
        } else {
          const elements = focusRegistry.getElements();
          const valueElement = elements.find((el) => el.id === 'value');
          if (valueElement?.ref.current instanceof HTMLInputElement) {
            valueToValidate = valueElement.ref.current.value;
          }
        }

        if (valueToValidate !== undefined) {
          const result = validate(valueToValidate);
          const isValid = result === true;
          onInvalidChange?.(!isValid);
        }
      }

      dispatch({ type: 'PLUGIN_FOCUS_LOST' });

      const pos = getPos();
      if (typeof pos === 'number') {
        const tr = editor.state.tr;
        const tokenNode = editor.state.doc.nodeAt(pos);

        if (tokenNode) {
          const afterTokenPos = pos + tokenNode.nodeSize;
          const $pos = tr.doc.resolve(afterTokenPos);
          const nodeAfter = $pos.nodeAfter;
          const hasSpacer = nodeAfter != null && isSpacer(nodeAfter);
          const cursorPos = hasSpacer ? afterTokenPos + nodeAfter.nodeSize : afterTokenPos;

          setTokenFocus(tr, { focusedPos: null });
          closeSuggestion(tr);
          tr.setMeta('exitingToken', true);
          tr.setSelection(TextSelection.create(tr.doc, cursorPos));
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
          onBlurCallback?.();
        }
      }
    },
    [editor, getPos, value, validate, onInvalidChange, focusRegistry, onBlurCallback]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editor.isEditable) return;

      const sortedHandlers = keyboardHandlersRegistry.getHandlersForKey(e.key);
      for (const { handler } of sortedHandlers) {
        const result = handler(e);
        if (result === true) return;
      }

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

  const handleDelete = useCallback(() => {
    if (!editor.isEditable) return;
    editor.view.focus();
    deleteNode();
  }, [deleteNode, editor]);

  const dispatchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e);
      e.stopPropagation();
    },
    [handleKeyDown]
  );

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
      immutable,
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
      immutable,
    ]
  );

  const wrapperClasses = 'tsi-token-wrapper';

  const tokenClasses = cn('tsi-token', className);

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
        data-range-selected={rangeSelected || undefined}
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
Token.LabelCombobox = TokenLabelCombobox;
Token.Operator = TokenOperator;
Token.Value = TokenValue;
Token.DeleteButton = TokenDeleteButton;
