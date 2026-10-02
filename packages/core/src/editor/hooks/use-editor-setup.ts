import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { type Editor, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardSerializer } from '../../extensions/clipboard-serializer';
import { CorePluginsExtension } from '../../extensions/core-plugins';
import {
  createEditorContext,
  type EditorConfig,
  EditorContextExtension,
  getEditorContext,
} from '../../extensions/editor-context';
import { KeyboardShortcutsExtension } from '../../extensions/keyboard-shortcuts';
import { SpacerNode } from '../../extensions/spacer-node';
import { TokenNavigation } from '../../extensions/token-navigation';
import { useIsomorphicLayoutEffect } from '../../hooks/use-isomorphic-layout-effect';
import { getTokenFocusState, tokenFocusKey } from '../../plugins/token-focus-plugin';
import {
  SelectionInvariantExtension,
  TokenSpacingExtension,
} from '../../plugins/token-spacing-plugin';
import { FORCE_VALIDATION_CHECK, ValidationExtension } from '../../plugins/validation-plugin';
import { createQuerySnapshot, parseQueryToDoc } from '../../serializer';
import { FilterTokenNode } from '../../tokens/filter-token/filter-token-node';
import { FreeTextTokenNode } from '../../tokens/free-text-token/free-text-token-node';
import type { QuerySnapshot } from '../../types';
import { isToken } from '../../utils/node-predicates';
import { EMPTY_SNAPSHOT, getAllTokens } from '../../utils/query-snapshot';
import {
  areTokenListsEqual,
  areTokenListsEqualExcludingFocused,
  type ComparableToken,
} from '../../utils/token-events';
import { isEditorEmpty } from '../editor-state';

export interface UseEditorSetupOptions {
  /** Read once: the configuration the editor starts with. Later changes go through `useEditorConfigSync`. */
  config: EditorConfig;
  /** Read once; must be a single character. */
  initialDelimiter: string | undefined;
  /** Read once. */
  defaultValue: string | undefined;
  disabled: boolean;
  immediatelyRender: boolean;
  onChange: ((snapshot: QuerySnapshot) => void) | undefined;
  onTokensChange: ((snapshot: QuerySnapshot) => void) | undefined;
}

export interface UseEditorSetupResult {
  editor: Editor | null;
  isEmpty: boolean;
}

/** Creates the editor with extensions and options that stay fixed for the component's lifetime. */
export function useEditorSetup({
  config,
  initialDelimiter,
  defaultValue,
  disabled,
  immediatelyRender,
  onChange,
  onTokensChange,
}: UseEditorSetupOptions): UseEditorSetupResult {
  const [isEmpty, setIsEmpty] = useState(true);

  // Track previous snapshot for onChange
  const prevSnapshotRef = useRef<QuerySnapshot>(EMPTY_SNAPSHOT);

  // Track confirmed (non-focused) tokens for onTokensChange
  // Only updated when onTokensChange fires
  const confirmedTokensRef = useRef<ComparableToken[]>([]);

  // Changing the extensions recreates the TipTap editor, which would discard the
  // content and the history. They are built once from the mount-time configuration;
  // the editor context storage seeded here is then kept current by useEditorConfigSync.
  const [initialContext] = useState(() =>
    createEditorContext({ ...config, delimiter: initialDelimiter })
  );
  const [extensions] = useState(() => [
    Document,
    Paragraph,
    Text,
    History,
    SpacerNode,
    FilterTokenNode,
    FreeTextTokenNode,
    TokenNavigation,
    ClipboardSerializer,
    ValidationExtension,
    TokenSpacingExtension,
    SelectionInvariantExtension,
    EditorContextExtension.configure(initialContext),
    KeyboardShortcutsExtension,
    CorePluginsExtension,
  ]);
  const [initialContent] = useState(() =>
    defaultValue
      ? parseQueryToDoc(defaultValue, initialContext.fields, {
          freeTextMode: initialContext.freeTextMode,
          unknownFields: initialContext.unknownFields,
          delimiter: initialContext.delimiter,
        })
      : ''
  );

  // useEditor compares these with the editor's options on every render and calls
  // setOptions when they differ, so both keep their identity: the content is read
  // once, and the attributes change only with `disabled`. The combobox
  // relationships that follow the suggestion state are written by SuggestionAria.
  const editorProps = useMemo(
    () => ({
      attributes: {
        'aria-label': 'Search query input',
        role: 'combobox',
        ...(disabled ? { 'aria-disabled': 'true' } : {}),
      },
    }),
    [disabled]
  );

  const editor = useEditor({
    immediatelyRender,
    extensions,
    content: initialContent,
    editable: !disabled,
    editorProps,
    onCreate: ({ editor: ed }) => {
      const tr = ed.state.tr;
      tr.setMeta(FORCE_VALIDATION_CHECK, true);
      ed.view.dispatch(tr);
    },
    onUpdate: ({ editor: ed }) => {
      const snapshot = createQuerySnapshot(ed.getJSON(), {
        delimiter: getEditorContext(ed).delimiter,
      });

      // Detect changes in confirmed (non-focused) filter tokens for onTokensChange
      if (onTokensChange) {
        const focusState = getTokenFocusState(ed.state);
        const focusedPos = focusState?.focusedPos ?? null;

        // Get focused token ID from node attrs
        let focusedTokenId: string | null = null;
        if (focusedPos !== null) {
          const node = ed.state.doc.nodeAt(focusedPos);
          if (node && isToken(node)) {
            focusedTokenId = (node.attrs as { id?: string }).id ?? null;
          }
        }

        const currentTokens = getAllTokens(snapshot);

        // Compare excluding focused token from BOTH lists
        // confirmedTokensRef always stores all tokens (unfiltered)
        // Filtering is applied during comparison only
        const isEqual = areTokenListsEqualExcludingFocused(
          confirmedTokensRef.current,
          currentTokens,
          focusedTokenId
        );

        if (!isEqual) {
          onTokensChange(snapshot);
          // Store all tokens (unfiltered) for next comparison
          confirmedTokensRef.current = currentTokens;
        }
      }

      prevSnapshotRef.current = snapshot;
      onChange?.(snapshot);
      setIsEmpty(isEditorEmpty(ed));
    },
    onTransaction: ({ editor: ed, transaction }) => {
      // Handle onTokensChange when focus leaves a token
      // onUpdate only fires on doc changes, but we need to detect focus changes too
      if (!onTokensChange) return;

      // Check if this transaction changed focusedPos to null
      const meta = transaction.getMeta(tokenFocusKey);
      if (!meta || meta.focusedPos !== null) return;

      // Skip if doc changed - onUpdate will handle it
      // This prevents double snapshot creation and ensures consistent behavior
      if (transaction.docChanged) return;

      // Focus is leaving a token without doc change - check for changes
      // Reuse prevSnapshotRef to avoid redundant snapshot creation
      const snapshot =
        prevSnapshotRef.current ??
        createQuerySnapshot(ed.getJSON(), { delimiter: getEditorContext(ed).delimiter });
      const currentTokens = getAllTokens(snapshot);

      // Compare full lists (no exclusion since focus is leaving)
      const isEqual = areTokenListsEqual(confirmedTokensRef.current, currentTokens);

      if (!isEqual) {
        onTokensChange(snapshot);
        confirmedTokensRef.current = currentTokens;
      }
    },
  });

  // Effects skip a destroyed editor. useEditor destroys an instance whose render is
  // not committed within a tick, which happens when React 19 commits a
  // Suspense-prerendered tree late. The commit then still sees that instance, and
  // useEditor re-renders with a fresh one right after.

  // Sync isEmpty state when editor becomes available
  // useIsomorphicLayoutEffect runs before paint on client, preventing placeholder flash
  // Falls back to useEffect on server for SSR compatibility
  useIsomorphicLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setIsEmpty(isEditorEmpty(editor));
  }, [editor]);

  // Sync disabled state with editor.isEditable. aria-disabled follows from editorProps.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return { editor, isEmpty };
}
