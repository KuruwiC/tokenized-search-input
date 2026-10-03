import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getEditorContext, resolveField } from '../../extensions/editor-context';
import { useTokenFocus } from '../../hooks/use-editor-store';
import type { TokenValidation } from '../../plugins/shared/meta';
import {
  dismissSuggestion,
  getSuggestionState,
  isSuggestionOpen,
} from '../../plugins/suggestion-plugin';
import {
  getFocusedToken,
  type LeaveDirection,
  type TokenFocusEntry,
} from '../../plugins/token-focus-plugin';
import { getValidationDescriptionId } from '../../plugins/token-meta-plugin';
import { isPickerType } from '../../suggestions/suggestion-type';
import { cn } from '../../utils/cn';
import { isHistoryShortcut } from '../history-shortcut';
import { enterToken } from '../token-focus';
import { TokenDeleteButton } from './blocks/token-delete-button';
import { TokenLabelCombobox } from './blocks/token-label-combobox';
import { TokenOperator } from './blocks/token-operator';
import { TokenValue } from './blocks/token-value';
import { TokenConfigContext, type TokenConfigContextValue } from './contexts/token-config-context';
import { TokenFocusContext, type TokenFocusContextValue } from './contexts/token-focus-context';
import { focusEntryBlock, useFocusRegistry } from './focus';

/** The key code of every key event an input method that is composing text reports. */
const COMPOSING_KEY_CODE = 229;

/** A press on a token edits it as a whole. */
const CLICK_ENTRY: TokenFocusEntry = { source: 'click', position: 'end', target: 'all' };

export type ClickTarget =
  | 'label'
  | 'operator'
  | 'value'
  | 'delete'
  /** A press the browser or ProseMirror resolves: Shift extending a range, a caret in an input. */
  | 'text-selection'
  /** A press on a token that cannot be edited, which selects the token whole. */
  | 'token-selection';

/**
 * Which part of the token a press lands on, `node` being what was pressed. A press on the
 * delete button always deletes. Otherwise a press on a block acts on that block, and
 * anywhere else, token padding or a value that is not being edited, it acts on the value.
 */
export function resolveClickTarget(
  event: Pick<React.MouseEvent, 'shiftKey'>,
  node: Element,
  immutable: boolean
): ClickTarget {
  const block = node.closest<HTMLElement>('[data-token-block]')?.dataset.tokenBlock;
  if (block === 'delete') return block;
  if (event.shiftKey || node instanceof HTMLInputElement) return 'text-selection';
  if (immutable) return 'token-selection';
  return block === 'label' || block === 'operator' ? block : 'value';
}

/** What a token is called when its view gives no name: its field's label and its value. */
function describeToken(editor: Editor, node: ProseMirrorNode): string {
  const { key, value } = node.attrs;
  const field = typeof key === 'string' ? resolveField(getEditorContext(editor), key) : null;
  const name = field?.label ?? (typeof key === 'string' ? key : '');
  const text = typeof value === 'string' ? value : '';
  if (name && text) return `${name}: ${text}`;
  return name || text || 'Token';
}

interface TokenAriaLabelState {
  name: string;
  focused: boolean;
  editable: boolean;
  immutable: boolean;
}

/** The accessible name of a token: what it is, then what can be done with it. */
function tokenAriaLabel({ name, focused, editable, immutable }: TokenAriaLabelState): string {
  if (focused) return `${name}. Editing.`;
  if (!editable) return `${name}. Disabled.`;
  if (immutable) return `${name}. Immutable. Click X to delete.`;
  return `${name}. Click to edit.`;
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
      focusRegistry.focusEdge('first', { entryOnly: true, position: 'end' });
      return;
    }
    enterToken(editor, id, CLICK_ENTRY);
  }, [editor, id, focusRegistry]);

  const selectToken = useCallback(() => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const tokenNode = editor.state.doc.nodeAt(pos);
    if (!tokenNode) return;

    editor.view.focus();
    const tr = editor.state.tr;
    tr.setSelection(TextSelection.create(tr.doc, pos, pos + tokenNode.nodeSize));
    editor.view.dispatch(tr);
  }, [editor, getPos]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const target = resolveClickTarget(e, e.target as Element, immutable);
      switch (target) {
        case 'text-selection':
          return;
        case 'token-selection':
          e.preventDefault();
          selectToken();
          return;
        case 'value':
          handleActivate();
          return;
        case 'delete':
          focusRegistry.get(target)?.activate?.();
          return;
        case 'label':
        case 'operator': {
          const block = focusRegistry.get(target);
          block?.focus('end');
          block?.activate?.();
          return;
        }
        default: {
          const exhaustive: never = target;
          return exhaustive;
        }
      }
    },
    [handleActivate, focusRegistry, immutable, selectToken]
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
      // A picker stays open until the user closes it
      if (isSuggestionOpen(suggestionState) && isPickerType(suggestionState.type)) return;

      editor.commands.leaveToken(id, 'right');
    },
    [editor, id]
  );

  // Keys no block handles: Escape closes the open suggestions and then leaves the token,
  // Tab leaves it to either side.
  const handleTokenKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        const suggestionState = getSuggestionState(editor.state);
        if (isSuggestionOpen(suggestionState)) {
          const tr = editor.state.tr;
          dismissSuggestion(tr);
          editor.view.dispatch(tr);
          return;
        }
        handleExitRight();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) handleExitLeft();
        else handleExitRight();
      }
    },
    [editor, handleExitLeft, handleExitRight]
  );

  // A key reaches the one block it was pressed in; a key pressed anywhere else in the
  // token, such as in a control a view adds, is left to that control. Keys of an input
  // method that is composing text reach nobody. Undo and redo are left to the editor,
  // which owns the history of token edits; everything else stops here.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editor.isEditable) return;
      if (e.nativeEvent.isComposing || e.keyCode === COMPOSING_KEY_CODE) {
        e.stopPropagation();
        return;
      }
      if (isHistoryShortcut(e.nativeEvent)) return;

      const blockId =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[data-token-block]')?.dataset.tokenBlock
          : undefined;
      const block = blockId === undefined ? undefined : focusRegistry.get(blockId);
      if (!block?.handleKey(e)) handleTokenKey(e);
      e.stopPropagation();
    },
    [editor, focusRegistry, handleTokenKey]
  );

  const handleDelete = useCallback(() => {
    if (!editor.isEditable) return;
    editor.view.focus();
    deleteNode();
  }, [deleteNode, editor]);

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
      isEditable: editor.isEditable,
      immutable,
    }),
    [isFocused, focusRegistry, currentFocusId, handleExitRight, editor.isEditable, immutable]
  );

  const wrapperClasses = 'tsi-token-wrapper';

  const tokenClasses = cn('tsi-token', className);

  const computedAriaLabel = tokenAriaLabel({
    name: ariaLabel ?? describeToken(editor, node),
    focused: isFocused,
    editable: editor.isEditable,
    immutable,
  });

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
            {children}
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
Token.LabelCombobox = TokenLabelCombobox;
Token.Operator = TokenOperator;
Token.Value = TokenValue;
Token.DeleteButton = TokenDeleteButton;
