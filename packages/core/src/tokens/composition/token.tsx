import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTokenFocus } from '../../hooks/use-editor-store';
import type { TokenValidation } from '../../plugins/shared/meta';
import {
  dismissSuggestion,
  getSuggestionState,
  isSuggestionOpen,
  type SuggestionType,
} from '../../plugins/suggestion-plugin';
import {
  getFocusedToken,
  type LeaveDirection,
  type TokenFocusEntry,
} from '../../plugins/token-focus-plugin';
import { getValidationDescriptionId } from '../../plugins/token-meta-plugin';
import { getDismissPolicy } from '../../suggestions/dismiss-policy';
import { cn } from '../../utils/cn';
import { enterToken } from '../token-focus';
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
import { focusEntryBlock, useFocusRegistry } from './focus';
import {
  isHistoryShortcut,
  KeyboardHandlersContext,
  useKeyboardHandlersRegistry,
} from './keyboard';

/** A press on a token edits it as a whole. */
const CLICK_ENTRY: TokenFocusEntry = { source: 'click', position: 'end', target: 'all' };

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
  deleteNode: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  /** The token's validation failure, as computed by the validation plugin. */
  validation?: TokenValidation;
  dataAttrs?: Record<string, string>;
  /** Make token immutable (only deletable via X button or 2-stage Backspace). Default: false */
  immutable?: boolean;
  /** Whether this token is part of a range selection */
  rangeSelected?: boolean;
}

/**
 * Token container component using Compound Components pattern.
 * Whether the token is focused is derived from the editor's token focus; the token
 * gives DOM focus to the block focus entered at and keeps track of which block holds it.
 */
export function Token({
  editor,
  getPos,
  node,
  deleteNode,
  children,
  className = '',
  ariaLabel,
  validation,
  dataAttrs,
  immutable = false,
  rangeSelected = false,
}: TokenProps): React.ReactElement {
  const containerRef = useRef<HTMLSpanElement>(null);
  const id = String(node.attrs.id);
  const entry = useTokenFocus(editor, id);
  const isFocused = entry !== null;
  const [currentFocusId, setCurrentFocusId] = useState<string | null>(null);

  const leave = useCallback(
    (direction: LeaveDirection, value?: string) => {
      editor.commands.leaveToken(id, direction, value);
      editor.view.focus();
    },
    [editor, id]
  );
  const handleExitLeft = useCallback(() => leave('left'), [leave]);
  const handleExitRight = useCallback((value?: string) => leave('right', value), [leave]);

  const focusRegistry = useFocusRegistry({
    onExitLeft: handleExitLeft,
    onExitRight: handleExitRight,
  });

  const keyboardHandlersRegistry = useKeyboardHandlersRegistry();

  // DOM focus follows the token focus: entering the token moves it to the block focus
  // entered at, and leaving the token moves it, if it is still in the token, to the editor.
  useLayoutEffect(() => {
    setCurrentFocusId(null);
    if (entry === null) {
      const container = containerRef.current;
      if (container?.contains(container.ownerDocument.activeElement)) editor.view.focus();
      return;
    }
    if (editor.isEditable) focusEntryBlock(focusRegistry, entry);
  }, [entry, editor, focusRegistry]);

  const handleActivate = useCallback(() => {
    if (getFocusedToken(editor.state)?.id === id) {
      focusRegistry.focusFirstEntryFocusable('end');
      return;
    }
    enterToken(editor, id, CLICK_ENTRY);
  }, [editor, id, focusRegistry]);

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
      if (!editor.isEditable || e.target !== containerRef.current) return;
      if (getFocusedToken(editor.state)?.id === id) return;
      enterToken(editor, id, CLICK_ENTRY);
    },
    [editor, id]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (getFocusedToken(editor.state)?.id !== id) return;

      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget && containerRef.current?.contains(relatedTarget)) return;

      const suggestionState = getSuggestionState(editor.state);
      if (isSuggestionOpen(suggestionState)) {
        const policy = getDismissPolicy(suggestionState.type as SuggestionType);
        if (policy.requireExplicitConfirm) return;
      }

      editor.commands.leaveToken(id, 'right');
    },
    [editor, id]
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
      // Undo and redo propagate to the editor, which owns the history of token edits
      if (isHistoryShortcut(e.nativeEvent)) return;
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
      deleteToken: handleDelete,
    }),
    [editor, getPos, node, handleDelete]
  );

  const focusContextValue: TokenFocusContextValue = useMemo(
    () => ({
      isFocused,
      focusRegistry,
      currentFocusId,
      setCurrentFocusId,
      exitToken: handleExitRight,
      dispatchKeyDown,
      isEditable: editor.isEditable,
      immutable,
    }),
    [
      isFocused,
      focusRegistry,
      currentFocusId,
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

  const validationMessage = validation ? (validation.message ?? validation.reason) : undefined;
  const validationDescriptionId = validation
    ? getValidationDescriptionId(String(node.attrs.id))
    : undefined;

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
      aria-describedby={validationDescriptionId}
      title={validationMessage}
      role="group"
      tabIndex={-1}
    >
      <span
        className={tokenClasses}
        data-focused={isFocused}
        data-state={dataState}
        data-invalid={validation !== undefined}
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
      {validationDescriptionId && (
        <span id={validationDescriptionId} className="tsi-sr-only">
          {validationMessage}
        </span>
      )}
    </NodeViewWrapper>
  );
}

// Attach block components as static properties for Compound Components pattern
Token.Label = TokenLabel;
Token.LabelCombobox = TokenLabelCombobox;
Token.Operator = TokenOperator;
Token.Value = TokenValue;
Token.DeleteButton = TokenDeleteButton;
